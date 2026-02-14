# Panduan Deployment Aplikasi Rekrutmen

Aplikasi ini menggunakan stack **Node.js (Express)** + **React (Vite)** + **SQLite**.

## ⚠️ Peringatan Penting: Database SQLite
Aplikasi ini menggunakan **SQLite** (`database.sqlite`) sebagai database default.
Jika Anda men-deploy ke platform cloud "ephemeral" seperti **Railway**, **Heroku**, atau **Render** (tanpa volume persistent):
1.  **Data akan hilang** setiap kali Anda melakukan deploy ulang atau aplikasi restart.
2.  **Solusi**: Gunakan **PostgreSQL** atau **MySQL** untuk production, atau pasang **Persistent Volume** (jika didukung, misal di Railway).

## Persiapan Environment Variables
Pastikan Anda mengatur Environment Variables berikut di panel deployment Anda:

| Variable | Deskripsi | Contoh |
|----------|-----------|--------|
| `PORT` | Port aplikasi (biasanya diatur otomatis oleh platform) | `8080` |
| `NODE_ENV` | Mode aplikasi | `production` |
| `SESSION_SECRET` | String acak untuk enkripsi sesi | `k4t4s4nd1_r4h4s14` |
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID (untuk upload file) | `...` |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret | `...` |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 Refresh Token | `...` |
| `GOOGLE_DRIVE_FOLDER_ID`| ID Folder Google Drive tujuan upload | `1abc...` |

## Langkah Deployment (Railway)

1.  **Push ke GitHub**: Pastikan kode sumber Anda sudah ada di repository GitHub.
2.  **Buka Railway**: Login ke [railway.app](https://railway.app/).
3.  **New Project**: Pilih "Deploy from GitHub repo".
4.  **Pilih Repo**: Pilih repository aplikasi ini.
5.  **Variables**: Sebelum deploy selesai, buka tab "Variables" dan masukkan environment variables di atas.
6.  **Build & Start**: Railway akan otomatis mendeteksi `package.json`:
    *   Install command: `npm install`
    *   Build command: `npm run build` (ini akan menjalankan `npm install --prefix client && npm run build --prefix client`)
    *   Start command: `npm start`

## Struktur File
- `/client`: Frontend React.
- `/models`: Database schema (Sequelize).
- `/routes`: API endpoints.
- `/public`: Aset statis backend.
- `/data`: Tempat penyimpanan database SQLite (local).
