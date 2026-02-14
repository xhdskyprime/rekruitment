# Panduan Setup Google Drive untuk Penyimpanan File

Agar aplikasi bisa menyimpan file (KTP, Ijazah, dll) ke Google Drive Anda secara otomatis, Anda perlu membuat "Service Account" di Google Cloud Platform. Ini gratis.

## Langkah 1: Buat Project di Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Login dengan akun Google Anda.
3. Klik dropdown project di bagian atas, lalu klik **New Project**.
4. Beri nama project (misal: `rekruitment-storage`), lalu klik **Create**.

## Langkah 2: Aktifkan Google Drive API
1. Di menu sebelah kiri, pilih **APIs & Services** > **Library**.
2. Cari "Google Drive API".
3. Klik **Google Drive API**, lalu klik **Enable**.

## Langkah 3: Buat Service Account (Robot Admin)
1. Pergi ke **APIs & Services** > **Credentials**.
2. Klik **Create Credentials** > **Service Account**.
3. Isi nama (misal: `drive-uploader`), klik **Create and Continue**.
4. Di bagian "Grant this service account access to project", pilih Role: **Basic** > **Editor**.
5. Klik **Continue**, lalu **Done**.

## Langkah 4: Download Kunci Akses (JSON)
1. Di daftar Service Accounts, klik email service account yang baru Anda buat (contoh: `drive-uploader@...`).
2. Masuk ke tab **Keys**.
3. Klik **Add Key** > **Create new key**.
4. Pilih **JSON**, lalu klik **Create**.
5. File JSON akan terdownload otomatis. Simpan baik-baik!

## Langkah 5: Setting di Railway (PENTING!)
File JSON tadi berisi data sensitif. Kita tidak boleh meng-upload file ini mentah-mentah ke GitHub.
Kita akan mengubah isinya menjadi format **Base64** agar bisa dimasukkan ke Environment Variable Railway.

### Cara Convert ke Base64:
**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\your-downloaded-file.json"))
```
*(Ganti `path\to\your-downloaded-file.json` dengan lokasi file JSON Anda)*

**Mac/Linux:**
```bash
base64 -i path/to/your-downloaded-file.json
```

### Masukkan ke Railway:
1. Copy hasil text panjang (string acak) dari perintah di atas.
2. Buka Dashboard Railway > Project `rekruitment`.
3. Masuk ke tab **Variables**.
4. Tambahkan variable baru:
   - **Key**: `GOOGLE_CREDENTIALS_BASE64`
   - **Value**: (Paste hasil string panjang tadi di sini)
5. Klik **Add**.

## Langkah 6: Share Folder Drive (Opsional tapi Direkomendasikan)
Secara default, file akan tersimpan di "Drive pribadi" milik Service Account tersebut (yang tidak bisa Anda buka lewat Gmail biasa). Agar Anda bisa melihat filenya lewat Google Drive Anda sendiri:

1. Buka file JSON credentials tadi dengan Notepad.
2. Cari `client_email` (misal: `drive-uploader@project-id.iam.gserviceaccount.com`).
3. Buka Google Drive Anda (drive.google.com).
4. Buat folder baru (misal: `Rekruitment Uploads`).
5. Klik kanan folder tersebut > **Share**.
6. Masukkan email service account tadi di kolom "Add people".
7. Pastikan role-nya **Editor**, lalu kirim.
8. (Opsional) Jika Anda ingin file masuk ke folder ini secara otomatis, Anda perlu mengambil ID folder (lihat di URL browser saat buka folder, bagian terakhir URL) dan memasukkannya ke kode backend (di `services/driveService.js` bagian `parents: ['FOLDER_ID']`). Tapi tanpa ini pun sistem tetap berjalan normal.

Selesai! Sekarang aplikasi Anda akan otomatis meng-upload file pelamar ke Google Drive, bukan ke harddisk server.
