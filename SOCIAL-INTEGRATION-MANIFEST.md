# Social Media Integration Manifest

Paket ini sudah mencakup seluruh perubahan Finance dan pagination terbaru.
Jangan gabungkan lagi dengan ZIP Social Media versi lama.

## File frontend baru

- `src/pages/SocialMedia.jsx`
- `src/pages/SocialMedia.css`
- `src/lib/socialApi.js`

## File frontend yang diperbarui

- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/components/Sidebar.css`
- `.gitignore`
- `README.md`
- `package.json`

## Supabase

- `supabase/social-media-preflight.sql`
- `supabase/social-media.sql`
- `supabase/social-media-validation.sql`

Seluruh objek baru menggunakan awalan `social_`. Tidak ada operasi delete,
update, truncate, atau drop terhadap tabel Finance yang sudah ada.

## Cloudflare Worker

- `worker/src/`
- `worker/tests/`
- `worker/package.json`
- `worker/package-lock.json`
- `worker/wrangler.jsonc`

Token platform dan Supabase service-role key wajib disimpan sebagai Worker
Secrets, bukan di GitHub atau environment frontend.

## Dokumentasi dan tes

- `SOCIAL-MEDIA-SETUP.md`
- `tests/social-integration-safety.test.mjs`
