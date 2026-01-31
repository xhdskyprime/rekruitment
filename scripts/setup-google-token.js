const { google } = require('googleapis');
const readline = require('readline');

// SETUP INSTRUCTIONS:
// 1. Go to Google Cloud Console > APIs & Services > Credentials
// 2. Create Credentials > OAuth client ID > Desktop App
// 3. Download the JSON file or copy Client ID and Client Secret
// 4. Run this script: node scripts/setup-google-token.js

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n=== GOOGLE DRIVE OAUTH SETUP ===');
console.log('This script will help you generate a Refresh Token for your app.\n');

rl.question('Enter Client ID: ', (clientId) => {
    rl.question('Enter Client Secret: ', (clientSecret) => {
        
        const oauth2Client = new google.auth.OAuth2(
            clientId.trim(),
            clientSecret.trim(),
            'https://developers.google.com/oauthplayground' // Using Playground as redirect target for easy code copying
        );

        const scopes = [
            'https://www.googleapis.com/auth/drive'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Essential for Refresh Token
            scope: scopes,
            prompt: 'consent' // Force approval to ensure refresh token is returned
        });

        console.log('\n---------------------------------------------------------');
        console.log('1. Open this URL in your browser:');
        console.log(`\n${url}\n`);
        console.log('---------------------------------------------------------');
        console.log('2. Login with your Google Account.');
        console.log('3. Allow access.');
        console.log('4. You will be redirected to "Google OAuth 2.0 Playground".');
        console.log('5. Look at the URL bar or the "Authorization code" box on the left.');
        console.log('6. Copy the "Authorization Code".');
        console.log('---------------------------------------------------------');

        rl.question('\nEnter Authorization Code: ', async (code) => {
            try {
                const { tokens } = await oauth2Client.getToken(code.trim());
                
                console.log('\n=== SUCCESS! ===');
                console.log('Here are your credentials for Railway Variables:');
                console.log('\nGOOGLE_CLIENT_ID=' + clientId.trim());
                console.log('GOOGLE_CLIENT_SECRET=' + clientSecret.trim());
                console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
                
                if (!tokens.refresh_token) {
                    console.log('\nWARNING: No refresh token returned. Did you try to re-auth without "prompt=consent"?');
                }

                console.log('\n=== NEXT STEPS ===');
                console.log('1. Copy these 3 variables to Railway.');
                console.log('2. Delete the old GOOGLE_CREDENTIALS_BASE64 variable.');
                console.log('3. Redeploy.');
                
            } catch (error) {
                console.error('\nError retrieving access token:', error.message);
            } finally {
                rl.close();
            }
        });
    });
});
