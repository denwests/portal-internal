# Social Media Integration — Validation

Tanggal: 30 Agustus 2026

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| Build React/Vite | Lulus |
| ESLint file integrasi Social Media | Lulus, 0 error |
| Safety test integrasi dan SQL | Lulus, 5/5 |
| Normalizer Instagram, Threads, TikTok | Lulus, 3/3 |
| Regression test Finance | Lulus, 3/3 |
| Regression test revenue period | Lulus, 3/3 |
| Pemeriksaan whitespace | Lulus |
| Pemeriksaan secret nyata di source | Tidak ditemukan |

Total pengujian otomatis: 14/14 lulus.

## Jaminan integrasi

- Customer Data tetap hanya Founder/Administrator.
- Staff tetap hanya Dashboard, Booking List, dan Client Gallery.
- Urutan Finance tetap Transactions → Customer Data → Spending → Bookkeeping.
- Pagination 10 baris tetap tersedia dan Social Inbox juga memakai 10 komentar per halaman.
- SQL Social Media tidak mengubah data pada tabel Finance yang sudah ada.
- Token platform dan Supabase service-role key tidak berada di frontend.

## Batas pengujian lokal

Sync dan reply nyata harus diuji setelah account ID, Worker secrets, dan izin API
production milik Pluno tersedia. Aktifkan serta uji satu platform terlebih dahulu,
kemudian lanjutkan ke platform berikutnya.
