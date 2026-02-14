# Panduan Setup Cloudflare untuk Website Rekrutmen

Cloudflare berfungsi sebagai CDN (Content Delivery Network) dan Firewall keamanan gratis. Ini akan membuat website lebih cepat diakses dari mana saja dan melindunginya dari serangan.

## Langkah 1: Pendaftaran & Setup Awal
1. Buka [Cloudflare.com](https://www.cloudflare.com/) dan buat akun (Sign Up).
2. Klik tombol **"Add a Site"**.
3. Masukkan nama domain Anda (misal: `rekrutmen-rsud.com`) lalu klik **Continue**.
4. Pilih **Free Plan** (paling bawah), lalu klik **Continue**.

## Langkah 2: Konfigurasi DNS
1. Cloudflare akan memindai DNS record Anda saat ini.
2. Pastikan record `A` atau `CNAME` yang mengarah ke Railway (atau server Anda) sudah ada.
   - Jika menggunakan Railway Custom Domain, Anda biasanya akan diberi target domain (misal: `rekrutmen-rsud.up.railway.app`).
   - Buat record **CNAME** di Cloudflare:
     - Name: `@` (atau `www`)
     - Target: `url-project-anda.up.railway.app`
     - Proxy status: **Proxied (Awan Oranye)** <- PENTING
3. Klik **Continue**.

## Langkah 3: Ubah Nameserver
1. Cloudflare akan memberikan 2 Nameserver (misal: `bob.ns.cloudflare.com` dan `alice.ns.cloudflare.com`).
2. Buka panel admin tempat Anda membeli domain (Niagahoster, IDCloudHost, Namecheap, dll).
3. Cari menu **Nameserver** atau **DNS Management**.
4. Ganti nameserver lama dengan 2 nameserver dari Cloudflare tadi.
5. Simpan perubahan.
6. Kembali ke Cloudflare dan klik **"Done, check nameservers"**.
   *Catatan: Proses ini bisa memakan waktu 1 jam hingga 24 jam (propagasi DNS).*

## Langkah 4: Konfigurasi SSL/TLS (Sangat Penting!)
Agar website tidak error "Too many redirects", atur SSL dengan benar:
1. Di dashboard Cloudflare, masuk ke menu **SSL/TLS**.
2. Ubah mode enkripsi menjadi **Full** atau **Full (Strict)**.
   - **JANGAN** pilih "Flexible" (ini sering menyebabkan loop redirect error dengan server modern).

## Langkah 5: Optimasi Tambahan (Opsional)
1. Ke menu **Speed** > **Optimization**.
2. Aktifkan **Auto Minify** (JavaScript, CSS, HTML).
3. Aktifkan **Brotli**.
4. Ke menu **Caching** > **Configuration**, set "Browser Cache TTL" ke **1 year** (karena kode kita sudah menghandle cache busting).

---
## Cek Status
Setelah Nameserver berubah (biasanya dapat email notifikasi dari Cloudflare), website Anda sekarang sudah dilindungi dan dipercepat oleh Cloudflare!
