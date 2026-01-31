const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');

// Load credentials from environment variable or file
const getAuth = () => {
    try {
        // Option 1: Load from base64 encoded env var (Best for Railway)
        if (process.env.GOOGLE_CREDENTIALS_BASE64) {
            const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
            return new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/drive.file'],
            });
        }
        
        // Option 2: Load from local file (Best for Local Dev)
        return new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../google-credentials.json'),
            scopes: ['https://www.googleapis.com/auth/drive.file'],
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
        
        const drive = google.drive({ version: 'v3', auth });
        
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileObject.buffer);

        const fileMetadata = {
            name: `${Date.now()}-${fileObject.originalname}`,
            parents: folderId ? [folderId] : [], // Optional: Specify folder ID in Drive
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
    }
};

module.exports = driveService;
