# PLUNO Social Media Monitoring — Setup Lengkap

Implementasi ini sudah digabungkan di atas versi Finance + pagination terakhir pada 30 Agustus 2026. Fitur Social Media tersedia untuk akun employee aktif dengan role `Founder` atau `Administrator`.

Paket Social Media lama jangan dipasang lagi karena berisi `App.jsx` dan `Sidebar.jsx` sebelum perubahan Finance. Gunakan paket integrasi terbaru ini saja.

## Hasil akhir

- Menu `04 Social Media` pada sidebar dengan badge jumlah komentar yang masih perlu dibalas.
- Satu inbox untuk `All`, `Instagram`, `TikTok`, dan `Threads`.
- Pencarian username, isi komentar, dan caption post.
- Status `New`, `Read`, `Replied`, `Resolved`, dan `Spam`.
- Balasan langsung ke platform dari portal.
- Token platform hanya tersimpan sebagai Cloudflare Worker secrets.
- Sinkronisasi manual dan otomatis setiap 10 menit.
- Tampilan tidak mengambil thumbnail, foto, atau video.

## Arsitektur

```text
React/Vite portal
  └─ Supabase login JWT
       └─ Cloudflare Social Worker
            ├─ validasi user + role employees
            ├─ Instagram / Threads / TikTok API
            └─ Supabase service role
                 ├─ social_accounts
                 ├─ social_posts
                 ├─ social_comments
                 ├─ social_replies
                 └─ social_sync_runs
```

React tidak pernah menerima access token Instagram, Threads, TikTok, maupun Supabase service role key.

## 1. Siapkan Supabase

1. Pastikan backup CSV Finance yang sebelumnya dibuat tetap disimpan.
2. Buka dashboard Supabase project yang dipakai portal.
3. Buka **SQL Editor** dan jalankan `supabase/social-media-preflight.sql`.
4. Salin seluruh isi `supabase/social-media.sql`, lalu jalankan sekali sampai muncul status sukses.
5. Jalankan `supabase/social-media-validation.sql`.
6. Buka **Table Editor** dan pastikan lima tabel `social_*` sudah muncul.

Migration hanya menambahkan objek bernama `social_*` dan tidak menghapus atau memperbarui data `customers`, `bookings`, `transactions`, `spendings`, `bookkeeping_reports`, maupun `employees`. RLS hanya memberi akses baca kepada Founder/Administrator aktif. Insert/update/reply dilakukan oleh Worker dengan service role.

## 2. Siapkan akses platform

### Instagram

Gunakan Instagram API untuk akun profesional (Business atau Creator). App Meta perlu minimal:

- `instagram_business_basic`
- `instagram_business_manage_comments`

Ambil:

- Instagram professional account ID → `INSTAGRAM_ACCOUNT_ID`
- Username akun → `INSTAGRAM_USERNAME`
- User access token yang berlaku → secret `INSTAGRAM_ACCESS_TOKEN`

Worker membaca `/{ig-user-id}/media`, membaca `/{ig-media-id}/comments`, dan membalas melalui `/{ig-comment-id}/replies`.

Dokumentasi resmi: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation>

### Threads

Buat Meta app dengan use case Threads dan minta scope:

- `threads_basic`
- `threads_content_publish`
- `threads_read_replies`
- `threads_manage_replies`

Ambil:

- Threads user ID → `THREADS_USER_ID`
- Username → `THREADS_USERNAME`
- Long-lived access token → secret `THREADS_ACCESS_TOKEN`

Worker membaca daftar post dan conversation, lalu membuat reply text dengan `reply_to_id` dan `auto_publish_text=true`.

Dokumentasi resmi: <https://developers.facebook.com/docs/threads/reply-moderation>

### TikTok

TikTok yang dipakai adalah **TikTok API for Business — Organic API**, bukan Research API. Hubungkan akun TikTok Business milik Pluno dan minta akses:

- TikTok Accounts → Get Account Media
- TikTok Accounts → Account Comment → Get Business Comment
- TikTok Accounts → Account Comment → Manage Account Comment

Ambil:

- Business account ID → `TIKTOK_BUSINESS_ID`
- Username → `TIKTOK_USERNAME`
- Access token → secret `TIKTOK_ACCESS_TOKEN`

Endpoint yang dipakai:

- `/open_api/v1.3/business/video/list/`
- `/open_api/v1.3/business/comment/list/`
- `/open_api/v1.3/business/comment/reply/list/`
- `/open_api/v1.3/business/comment/reply/create/`

Dokumentasi resmi: <https://business-api.tiktok.com/portal/docs>

> TikTok tidak akan aktif hanya dengan mengubah akun menjadi Business. App dan scope Organic API tetap harus disetujui. Sampai approval selesai, biarkan variabel/token TikTok kosong; Instagram dan Threads tetap dapat berjalan sendiri.

## 3. Konfigurasi Cloudflare Worker

Masuk ke folder Worker:

```bash
cd worker
npm install
```

Edit `worker/wrangler.jsonc`:

1. Pastikan `ALLOWED_ORIGINS` memuat URL production portal. URL Pluno saat ini sudah tercantum.
2. Isi account ID dan username hanya untuk platform yang sudah disetujui.
3. `META_GRAPH_VERSION` dibuat terpisah agar mudah dinaikkan saat Meta mengganti versi Graph API.
4. `SYNC_POST_LIMIT` default `25`; naikkan perlahan setelah memeriksa rate limit.

Jangan menaruh access token atau service role key di `wrangler.jsonc`.

Tambahkan secrets satu per satu:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put INSTAGRAM_ACCESS_TOKEN
npx wrangler secret put THREADS_ACCESS_TOKEN
npx wrangler secret put TIKTOK_ACCESS_TOKEN
```

Catatan:

- `SUPABASE_URL` adalah base project URL, misalnya `https://xxxx.supabase.co`, tanpa `/rest/v1`.
- `SUPABASE_ANON_KEY` dapat memakai publishable/anon key portal.
- `SUPABASE_SERVICE_ROLE_KEY` hanya boleh berada di Worker secret.
- Perintah token platform hanya perlu dijalankan untuk platform yang benar-benar digunakan.

Deploy Worker:

```bash
npm run deploy
```

Simpan URL hasil deploy, misalnya:

```text
https://pluno-social-inbox.<subdomain>.workers.dev
```

Cron `*/10 * * * *` akan ikut terpasang melalui `wrangler.jsonc`. Cron Cloudflare memakai waktu UTC, tetapi pola setiap 10 menit tidak terpengaruh zona waktu.

Referensi Cloudflare:

- Secrets: <https://developers.cloudflare.com/workers/configuration/secrets/>
- Cron Triggers: <https://developers.cloudflare.com/workers/configuration/cron-triggers/>

## 4. Hubungkan React ke Worker

Untuk lokal, buat file `.env.local` di root portal:

```env
VITE_SOCIAL_API_URL=http://localhost:8787
```

Jalankan Worker dan portal pada dua terminal:

```bash
cd worker
npm run dev
```

```bash
npm run dev
```

Untuk production Cloudflare, tambahkan build environment variable pada project portal:

```text
VITE_SOCIAL_API_URL=https://pluno-social-inbox.<subdomain>.workers.dev
```

Kemudian build/deploy ulang portal. Nilai `VITE_*` dimasukkan saat build, jadi mengubah variable tanpa build ulang tidak cukup.

## 5. Deploy frontend

Setelah SQL dan Worker siap, deploy project root seperti biasa. Jangan hanya menyalin paket Social Media lama. ZIP integrasi terbaru sudah memuat Finance, pagination 10 baris, dan Social Media dalam satu source.

Urutan menu Founder/Admin menjadi:

```text
01 Dashboard
02 Booking List
03 Client Gallery
04 Social Media
05 Transactions
06 Customer Data
07 Spending
08 Bookkeeping
09 Employee (Founder)
10 Documents (Founder)
```

Staff tetap hanya melihat Dashboard, Booking List, dan Client Gallery.

## 6. Validasi sebelum dipakai admin

Jalankan pemeriksaan source:

```bash
npm install
npm run build
```

Jalankan unit test Worker:

```bash
cd worker
npm test
```

Lalu lakukan smoke test:

1. Buka `https://<worker-url>/health`; hasil harus memiliki `"ok": true`.
2. Login portal sebagai Founder atau Administrator.
3. Buka menu `04 Social Media`.
4. Klik **Sync Now**.
5. Pastikan status koneksi platform sesuai variabel yang telah diisi.
6. Buat satu komentar uji dari akun pribadi pada post milik Pluno.
7. Sync lagi dan buka komentar tersebut.
8. Kirim balasan singkat.
9. Periksa balasan benar-benar muncul pada platform.
10. Pastikan status berubah menjadi `Replied` dan badge sidebar berkurang.

Lakukan pengujian reply satu platform pada satu waktu. Jangan mengaktifkan seluruh token sekaligus sebelum tiap platform berhasil melalui smoke test.

## 7. Perilaku badge dan status

- `New`: komentar baru, masuk hitungan badge.
- `Read`: sudah dibuka tetapi belum ditangani, tetap masuk hitungan badge.
- `Replied`: balasan berhasil dikirim ke platform, keluar dari badge.
- `Resolved`: tidak perlu dibalas, keluar dari badge.
- `Spam`: dikeluarkan dari antrean dan tidak dapat dibalas sampai dibuka kembali.

Worker menggunakan `idempotency_key` untuk setiap balasan. Jika browser mengulang request yang sama, Worker tidak mengirim balasan duplikat.

## 8. Troubleshooting

### Menu muncul tetapi data kosong

- Pastikan `VITE_SOCIAL_API_URL` tersedia pada build production.
- Buka endpoint `/health` Worker.
- Periksa Worker Logs dan tabel `social_sync_runs`.
- Pastikan access token belum kedaluwarsa dan account ID cocok dengan token.

### HTTP 403 dari Worker

- URL portal harus ada di `ALLOWED_ORIGINS`.
- User login harus ada di tabel `employees`, status `Aktif`, role `Founder` atau `Administrator`.
- Setelah mengubah role employee, logout lalu login ulang.

### Instagram/Threads permission error

- Periksa token pada Meta Access Token Debugger.
- Pastikan app berada pada mode yang sesuai dan permission sudah melewati App Review untuk user production.
- Pastikan akun yang memberi izin adalah pemilik/pengelola akun profesional Pluno.

### TikTok error meski token valid

- Pastikan token diberi scope Organic API, bukan hanya Ads API.
- Pastikan Business Account sudah diotorisasi ke app.
- Cocokkan `TIKTOK_BUSINESS_ID` dengan account yang diotorisasi token.

### Balasan sudah muncul di platform tetapi portal menampilkan error pencatatan

Jangan klik kirim ulang. Periksa platform terlebih dahulu, lalu lihat row `pending` pada `social_replies` dan Worker Logs. Perlindungan ini sengaja mencegah duplikasi ketika platform sukses tetapi Supabase mengalami gangguan sesaat.

## 9. Checklist production

- [ ] SQL migration sukses.
- [ ] RLS aktif pada seluruh tabel `social_*`.
- [ ] Service role key hanya ada di Worker secret.
- [ ] Origin production sesuai.
- [ ] App Review/approval platform selesai.
- [ ] Token long-lived dan jadwal rotasi token terdokumentasi.
- [ ] Sync manual setiap platform sukses.
- [ ] Reply test setiap platform sukses.
- [ ] Cron terlihat pada Cloudflare Worker Triggers.
- [ ] Worker logs dan `social_sync_runs` dipantau setelah go-live.
