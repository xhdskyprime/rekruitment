const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
const fs = require('fs');

// Load credentials from environment variable or file
const getAuth = () => {
    try {
        // Option 1: OAuth2 (New Method - Required for Personal Gmail)
        // Service Accounts now have 0 quota and cannot upload files to Personal Drive.
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
            const { OAuth2 } = google.auth;
            const oAuth2Client = new OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                'https://developers.google.com/oauthplayground' // Default redirect URI
            );
            
            oAuth2Client.setCredentials({
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN
            });
            
            return oAuth2Client;
        }

        // Option 2: Load from base64 encoded env var (Legacy / Workspace Only)
        if (process.env.GOOGLE_CREDENTIALS_BASE64) {
            const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
            return new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/drive'], // Changed to full drive scope to ensure visibility of shared folders
            });
        }
        
        // Option 2: Load from local file (Best for Local Dev)
        return new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../google-credentials.json'),
            scopes: ['https://www.googleapis.com/auth/drive'], // Changed to full drive scope
        });
    } catch (error) {
        console.error("Google Auth Error:", error.message);
        return null;
    }
};

const driveService = {
    uploadFile: async (fileObject, folderId = null, customName = null) => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");
        
        // DEBUG: Log Service Account Email for verification
        try {
            const client = await auth.getClient();
            console.log("Service Account Email:", client.email); 
        } catch (e) {
            console.log("Could not retrieve SA email for logging");
        }

        const drive = google.drive({ version: 'v3', auth });
        
        let mediaBody;
        if (fileObject.path) {
            // If file is on disk (multer diskStorage)
            mediaBody = fs.createReadStream(fileObject.path);
        } else if (fileObject.buffer) {
            // If file is in memory (multer memoryStorage)
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileObject.buffer);
            mediaBody = bufferStream;
        } else {
            throw new Error("Invalid file object: missing path or buffer");
        }

        let targetFolderId = folderId;
        if (!targetFolderId && process.env.GOOGLE_DRIVE_FOLDER_ID) {
            // Sanitize ID: remove query params like ?hl=id and whitespace
            targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.split('?')[0].trim();
        }

        if (!targetFolderId) {
            throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing. Service Accounts cannot upload to their own root directory (0 quota). Please set the folder ID in environment variables.");
        }

        console.log(`Attempting upload to Folder ID: ${targetFolderId}`);

        // Use custom name if provided, else timestamp-originalName
        const fileName = customName || `${Date.now()}-${fileObject.originalname}`;

        const fileMetadata = {
            name: fileName,
            parents: [targetFolderId], 
        };

        const media = {
            mimeType: fileObject.mimetype,
            body: mediaBody,
        };

        try {
            const response = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, webContentLink',
            });
            return response.data;
        } catch (error) {
            console.error('Drive Upload Error:', error);
            throw error;
        }
    },
    ensureFolder: async (name, parentId = null) => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");
        const drive = google.drive({ version: 'v3', auth });
        let rootId = parentId;
        if (!rootId && process.env.GOOGLE_DRIVE_FOLDER_ID) {
            rootId = process.env.GOOGLE_DRIVE_FOLDER_ID.split('?')[0].trim();
        }
        if (!rootId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing.");
        const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`;
        const list = await drive.files.list({ q, fields: 'files(id,name)' });
        if (list.data.files && list.data.files.length > 0) {
            return list.data.files[0].id;
        }
        const created = await drive.files.create({
            requestBody: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [rootId]
            },
            fields: 'id,name'
        });
        return created.data.id;
    },
    renameFile: async (fileId, newName) => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");
        const drive = google.drive({ version: 'v3', auth });
        const updated = await drive.files.update({
            fileId,
            requestBody: { name: newName },
            fields: 'id,name'
        });
        return updated.data;
    },

    getFileStream: async (fileId, res, disposition = 'inline') => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");

        const drive = google.drive({ version: 'v3', auth });

        try {
            const meta = await drive.files.get({
                fileId,
                fields: 'name,mimeType'
            });
            let mimeType = meta.data.mimeType || 'application/octet-stream';
            const name = meta.data.name || 'file';

            // Fallback for PDF if mimeType is generic
            if ((mimeType === 'application/octet-stream' || !mimeType) && name.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf';
            }

            console.log(`[DriveService] Streaming file: ${name} (${mimeType})`);

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(name)}"`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
            
            const response = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            
            response.data
                .on('end', () => {
                    // console.log('Done streaming file');
                })
                .on('error', (err) => {
                    console.error('Error streaming file:', err);
                    res.status(500).send('Error streaming file');
                })
                .pipe(res);
        } catch (error) {
            console.error('Drive Get Error:', error);
            res.status(404).send('File not found');
        }
    },

    getFileBuffer: async (fileId) => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");

        const drive = google.drive({ version: 'v3', auth });

        try {
            const response = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'arraybuffer' }
            );
            return Buffer.from(response.data);
        } catch (error) {
            console.error('Drive Get Buffer Error:', error);
            throw error;
        }
    },
    
    getFileMeta: async (fileId) => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");
        const drive = google.drive({ version: 'v3', auth });
        try {
            const meta = await drive.files.get({
                fileId,
                fields: 'id,name,mimeType,webViewLink,webContentLink'
            });
            return meta.data;
        } catch (error) {
            console.error('Drive Get Meta Error:', error);
            throw error;
        }
    }
};

module.exports = driveService;
