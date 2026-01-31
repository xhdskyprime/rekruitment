const { google } = require('googleapis');
const readline = require('readline');
const { OAuth2 } = google.auth;

// === PANDUAN PENTING (BACA DULU) ===
// Agar tidak error "Access blocked", Anda HARUS setting di Google Cloud Console seperti ini:
// 1. Buat Credentials baru pilih tipe: "WEB APPLICATION" (JANGAN pilih Desktop App).
// 2. Di kolom "Authorized redirect URIs", masukkan URL ini persis:
//    https://developers.google.com/oauthplayground
// 3. Klik Create, lalu copy Client ID & Client Secret ke sini.

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n=== SETUP GOOGLE DRIVE (WEB APPLICATION MODE) ===');
console.log('Pastikan Anda sudah membuat credential tipe "Web Application"');
console.log('dan memasukkan "https://developers.google.com/oauthplayground" ke Authorized redirect URIs.\n');

rl.question('Masukkan Client ID: ', (clientId) => {
    rl.question('Masukkan Client Secret: ', (clientSecret) => {
        
        const oauth2Client = new OAuth2(
            clientId.trim(),
            clientSecret.trim(),
            'https://developers.google.com/oauthplayground' // Redirect URI harus COCOK 100% dengan di Console
        );

        const scopes = [
            'https://www.googleapis.com/auth/drive' // Full Access Scope
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Wajib supaya dapat Refresh Token
            scope: scopes,
            prompt: 'consent' // Wajib supaya user ditanya "Allow" lagi
        });

        console.log('\n---------------------------------------------------------');
        console.log('1. Buka Link ini di Browser:');
        console.log(`\n${url}\n`);
        console.log('---------------------------------------------------------');
        console.log('2. Login akun Google Anda.');
        console.log('3. Jika muncul peringatan "Google hasn\'t verified this app", klik "Advanced" -> "Go to ... (unsafe)".');
        console.log('4. Klik Allow/Izinkan.');
        console.log('5. Anda akan diarahkan ke halaman "Google OAuth 2.0 Playground".');
        console.log('6. Di sebelah kiri (Step 2), copy kode di kotak "Authorization code".');
        console.log('---------------------------------------------------------');

        rl.question('\nPaste Authorization Code di sini: ', async (code) => {
            try {
                const { tokens } = await oauth2Client.getToken(code.trim());
                
                console.log('\n=== BERHASIL! ===');
                console.log('Simpan 3 data ini ke Railway Variables:');
                console.log('\nGOOGLE_CLIENT_ID=' + clientId.trim());
                console.log('GOOGLE_CLIENT_SECRET=' + clientSecret.trim());
                console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
                
                if (!tokens.refresh_token) {
                    console.log('\n[!] WARNING: Tidak ada Refresh Token. Coba ulangi dan pastikan klik "Allow".');
                }

            } catch (error) {
                console.error('\nERROR:', error.message);
                console.log('Tips: Pastikan Redirect URI di Google Console sudah benar.');
            } finally {
                rl.close();
            }
        });
    });
});
