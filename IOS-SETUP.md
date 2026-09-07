# Menjalankan PLUNO Internal di iPhone

Proyek iOS sudah dibuat dengan Capacitor 8 dan Swift Package Manager di folder
`ios`. Aplikasi tetap memakai build React/Vite lokal; Supabase dan Cloudflare
Worker tetap diakses melalui HTTPS seperti pada versi web.

## 1. Persyaratan Mac

- macOS dengan Xcode 26 atau lebih baru.
- Xcode Command Line Tools (`xcode-select --install`).
- Node.js 22 atau lebih baru.
- Apple ID yang sudah ditambahkan ke Xcode. Akun gratis cukup untuk mencoba di
  iPhone sendiri; distribusi memerlukan Apple Developer Program.

Capacitor 8 menggunakan Swift Package Manager secara default, jadi CocoaPods
tidak diperlukan untuk konfigurasi proyek ini.

## 2. Salin repo ke Mac dan pasang dependency

Jangan menyalin `node_modules` dari Windows. Dari root repo di Mac, jalankan:

```text
npm ci
```

Salin nilai environment lokal ke `.env.local` pada Mac. Variabel yang dipakai
portal saat ini tercantum di `.env.example`. Jangan memasukkan Supabase
service-role key atau token platform sosial ke variabel `VITE_*`, karena nilai
tersebut masuk ke bundle aplikasi.

`VITE_PUBLIC_APP_URL` dipakai hanya saat aplikasi membuat link gallery/timeline
yang akan dibagikan keluar WebView. Default-nya `https://internal.plunostudio.com`;
ubah variabel itu bila domain production portal berubah.

## 3. Izinkan link reset password Supabase

Di Supabase Dashboard buka Authentication > URL Configuration > Redirect URLs,
lalu tambahkan:

```text
com.plunostudio.portalinternal://reset-password
```

Login email/password biasa tidak memerlukan redirect ini. Entri tersebut khusus
agar link reset password dari email dapat membuka aplikasi dan memulihkan
session Supabase.

## 4. Izinkan origin aplikasi di Cloudflare Worker

Source Worker sudah menambahkan `capacitor://localhost` ke `ALLOWED_ORIGINS`.
Deploy konfigurasi Worker dari Mac atau komputer yang sudah login ke Wrangler:

```text
npm ci --prefix worker
npm exec --prefix worker wrangler deploy
```

Pastikan `VITE_SOCIAL_API_URL` di `.env.local` menunjuk ke URL Worker HTTPS yang
sudah dideploy. Token Instagram, Threads, TikTok, serta Supabase service-role
tetap disimpan sebagai Worker secrets; jangan pindahkan ke aplikasi iOS.

## 5. Build dan sinkronkan ke Xcode

Setiap kali source React atau `.env.local` berubah, jalankan:

```text
npm run ios:sync
```

Perintah tersebut membuat bundle Vite production ke `dist`, lalu menyalinnya ke
proyek native dan menyinkronkan plugin Capacitor.

## 6. Jalankan pada iPhone melalui Xcode

1. Hubungkan iPhone ke Mac, buka kunci perangkat, lalu pilih Trust jika diminta.
2. Jalankan `npm run ios:open` dari root repo.
3. Di Xcode pilih target **App**, lalu tab **Signing & Capabilities**.
4. Aktifkan **Automatically manage signing** dan pilih Team Apple ID Anda.
5. Pastikan Bundle Identifier tetap `com.plunostudio.portalinternal`. Jika ID ini
   sudah dipakai akun lain, ganti ke ID unik milik organisasi pada Xcode dan
   `capacitor.config.json`, kemudian jalankan kembali `npm run ios:sync`.
6. Pilih iPhone pada device selector, lalu tekan tombol Run.
7. Jika iPhone meminta Developer Mode, aktifkan dari Settings > Privacy &
   Security > Developer Mode, restart, lalu Run kembali.

## 7. Checklist smoke test di iPhone

- Login dengan akun aktif, refresh/relaunch, dan logout.
- Buka semua route sesuai role dan pastikan proteksi Founder/Administrator/Staff
  tetap berlaku.
- Minta reset password, buka email di iPhone, dan pastikan link kembali ke layar
  Reset Password dalam aplikasi.
- Buka data Supabase (dashboard, booking, customer, transaksi, dan galeri).
- Uji Social Media inbox setelah Worker terbaru dideploy.
- Uji download/share PDF serta tautan WhatsApp pada perangkat asli.
- Uji Google Drive gallery dengan OAuth client yang mengizinkan flow iOS; Google
  dapat menolak origin WebView jika OAuth client hanya dikonfigurasi untuk web.

## Alur update berikutnya

Tidak perlu menjalankan `cap add ios` lagi. Gunakan urutan berikut:

```text
npm ci
npm run ios:sync
npm run ios:open
```

Folder `ios` dan `package-lock.json` harus disimpan di Git. Folder `dist`,
`node_modules`, `.env.local`, dan Worker secret files tetap tidak disimpan.
