# Panduan Deployment ke Public (Production)

Aplikasi ini menggunakan stack **PERN/MERN** (tanpa Mongo, pakai SQLite):
- **Frontend**: React + Vite (di folder `client`)
- **Backend**: Node.js + Express (di root)
- **Database**: SQLite (File `database.sqlite`)

Karena menggunakan **SQLite** (database berbasis file), Anda membutuhkan hosting yang mendukung **Persistent Disk** (penyimpanan permanen). Hosting gratisan biasa (seperti Vercel/Heroku Free Tier) sering mereset file sistem, sehingga data database bisa hilang.

## Opsi Hosting Terbaik

### 1. VPS (Virtual Private Server) - Paling Direkomendasikan
Hosting seperti **DigitalOcean Droplet**, **AWS Lightsail**, atau **Biznet Gio** (Lokal).
- **Kelebihan**: Kontrol penuh, data aman, murah ($5-10/bulan).
- **Kekurangan**: Perlu setup manual (Linux).

**Langkah Deployment di VPS (Ubuntu):**
1. Sewa VPS Ubuntu.
2. Install Node.js & Git.
3. Clone repository ini.
4. Jalankan perintah build:
   ```bash
   npm install
   npm run build
   ```
   *Perintah ini akan menginstall dependency backend & frontend, lalu membuild React menjadi file statis.*
5. Jalankan aplikasi dengan PM2 (Process Manager) agar tetap hidup:
   ```bash
   npm install -g pm2
   pm2 start app.js --name "rekruitment-app"
   ```
6. Setup Nginx sebagai Reverse Proxy agar bisa diakses via domain (port 80/443).

### 2. Railway / Render (PaaS)
Jika ingin yang lebih otomatis, gunakan **Railway** atau **Render**.
- **Railway**: Mendukung "Volumes" untuk menyimpan file `database.sqlite` agar tidak hilang saat redeploy.
- **Render**: Mendukung "Disk" (berbayar).

**Langkah Deployment di Railway:**
1. Upload kode ke GitHub.
2. Buka Railway dashboard -> New Project -> Deploy from GitHub repo.
3. Tambahkan **Volume** di pengaturan Railway dan mount ke path `/app` (atau di mana file database berada).
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: (isi random string panjang)

## Persiapan Kode (Sudah Saya Lakukan)
Saya telah memodifikasi kode agar siap deploy:
1. **Frontend Build Script**: Menambahkan script `npm run build` di root folder yang otomatis membuild frontend React.
2. **Static Serving**: Backend `app.js` sekarang otomatis melayani file frontend React jika diakses dari browser.
3. **Relative Paths**: Frontend tidak lagi hardcode ke `localhost:3000`, tapi otomatis menyesuaikan domain tempat ia dihosting.
4. **Proxy Dev**: Saat development (`npm run dev`), proxy otomatis meneruskan request ke backend.

## Cara Test Mode Production di Lokal
Anda bisa mensimulasikan mode production di komputer Anda sendiri:

1. Matikan semua terminal yang sedang jalan.
2. Buka terminal baru di root folder project.
3. Jalankan:
   ```bash
   npm run build
   ```
   *(Tunggu sampai proses build React selesai)*
4. Jalankan server:
   ```bash
   node app.js
   ```
5. Buka `http://localhost:3000` di browser.
   - Anda akan melihat tampilan React, tapi kali ini dilayani langsung oleh server Node.js (bukan Vite server).
   - Coba login dan input data untuk memastikan semua berjalan lancar.

Jika berhasil, berarti aplikasi siap di-upload ke server VPS atau Hosting pilihan Anda!
