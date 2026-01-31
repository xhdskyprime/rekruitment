# Panduan Deployment ke Railway (Khusus SQLite)

Aplikasi ini menggunakan **SQLite**, yang menyimpan data dalam file (`database.sqlite`). Di layanan cloud seperti Railway, file sistem bersifat "ephemeral" (sementara), artinya **data akan hilang** setiap kali Anda update/redeploy aplikasi, KECUALI jika Anda menggunakan **Volume**.

Berikut langkah-langkah agar data Anda AMAN di Railway:

## 1. Persiapan Repository (GitHub)
Pastikan kode Anda sudah di-push ke GitHub.
File `.gitignore` sudah saya setting agar folder `data/` tidak ikut di-upload (karena kita ingin data production terpisah dari data local laptop Anda).

## 2. Buat Project di Railway
1. Login ke [Railway.app](https://railway.app/).
2. Klik **New Project** > **Deploy from GitHub repo**.
3. Pilih repository `rekruitment` Anda.
4. Klik **Deploy Now**.

## 3. PENTING: Setting Volume (Agar Data Tidak Hilang)
Setelah proses deploy berjalan (atau selesai), segera lakukan ini:

1. Klik kotak project Anda di dashboard Railway.
2. Pergi ke tab **Settings**.
3. Scroll ke bawah cari bagian **Railway Volume**.
4. Klik **Add Volume** (atau "New Volume").
5. Masukkan **Mount Path**: `/app/data`
   - *Penjelasan: Ini akan "menempelkan" harddisk permanen ke folder `data` di aplikasi Anda.*
6. Klik **Add**.
7. Railway akan otomatis me-restart (redeploy) aplikasi Anda.

## 4. Setting Environment Variables
Di tab **Variables**, tambahkan:
- `NODE_ENV`: `production`
- `SESSION_SECRET`: (Isi dengan password acak yang panjang, contoh: `kuncirahasia12345!@#`)
- `PORT`: `3000` (Opsional, Railway biasanya otomatis inject ini, tapi bagus untuk diset).

## 5. Generate Public Domain
1. Pergi ke tab **Settings**.
2. Di bagian **Networking** -> **Public Networking**.
3. Klik **Generate Domain**.
4. Anda akan dapat URL seperti `rekruitment-production.up.railway.app`.
5. Buka URL tersebut di browser.

## Catatan Teknis (Sudah Saya Atur)
- **Start Command**: Railway akan menjalankan `npm start`. Saya sudah setting `npm start` untuk menjalankan `node app.js`.
- **Build Command**: Railway otomatis mendeteksi `package.json` dan menjalankan `npm install` lalu `npm run build` (jika ada). Saya sudah buat script `build` yang otomatis meng-install dan compile React frontend.
- **Database & Uploads**: Kode sudah saya modifikasi agar menyimpan database dan file upload pelamar ke dalam folder `data/`. Karena Anda sudah me-mount Volume ke `/app/data`, maka file-file ini akan tersimpan permanen di Volume Railway.

Selamat! Aplikasi Anda sekarang live di Railway dengan database yang aman.
