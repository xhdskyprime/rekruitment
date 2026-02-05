const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');

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
    uploadFile: async (fileObject, folderId = null) => {
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
        
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileObject.buffer);

        let targetFolderId = folderId;
        if (!targetFolderId && process.env.GOOGLE_DRIVE_FOLDER_ID) {
            // Sanitize ID: remove query params like ?hl=id and whitespace
            targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID.split('?')[0].trim();
        }

        if (!targetFolderId) {
            throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing. Service Accounts cannot upload to their own root directory (0 quota). Please set the folder ID in environment variables.");
        }

        console.log(`Attempting upload to Folder ID: ${targetFolderId}`);

        // OPTIMIZATION: Removed redundant folder permission check to speed up upload.
        // The upload will fail automatically if permission is denied.

        const fileMetadata = {
            name: `${Date.now()}-${fileObject.originalname}`,
            parents: [targetFolderId], 
        };

        const media = {
            mimeType: fileObject.mimetype,
            body: bufferStream,
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

    getFileStream: async (fileId, res) => {
        const auth = getAuth();
        if (!auth) throw new Error("Google Auth credentials missing");

        const drive = google.drive({ version: 'v3', auth });

        try {
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
    }
};

module.exports = driveService;
