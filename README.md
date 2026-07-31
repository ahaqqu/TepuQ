# TepuQ

TepuQ adalah permainan browser sederhana untuk anak 15 bulan ke atas yang belajar mengenal objek, suara, dan koordinasi tangan–penglihatan.

## Dua Mode Bermain

- **TepuQ Bebas** — anak menekan tombol keyboard atau mengetuk layar mana saja. Kartu foto muncul dengan suara.
- **TepuQ Target** — anak harus mengetuk kartu fotonya untuk melanjutkan ke objek berikutnya.

## Cara Menjalankan di Lokal

Butuh [Bun](https://bun.sh/) yang sudah terinstall.

```bash
bun install        # install dependencies
bun run dev        # dev server di http://localhost:5173
bun run preview    # preview build production
```

Buka di browser:

- Bermain: `http://localhost:5173`
- Admin: `http://localhost:5173?mode=admin`

## Fitur Admin

- Tambah, edit, hapus objek.
- Upload foto atau ambil foto langsung dari kamera.
- Rekam suara sendiri dengan toggle untuk menggantikan TTS.
- Atur warna tema dan animasi kartu.
- Atur kecepatan, pitch, dan volume suara TTS Bahasa Indonesia.
- Atur tombol cepat (key binding) untuk objek tertentu.
- Export data ke ZIP (`tepuq-data.zip`) untuk backup.
- Import ZIP untuk memindahkan data antar browser atau perangkat.

## Teknologi

- Vite untuk build dan dev server.
- Vanilla JavaScript + HTML + CSS, tanpa framework eksternal.
- IndexedDB untuk penyimpanan lokal browser.
- JSZip dan FileSaver untuk export/import.
- Web Speech API untuk suara Bahasa Indonesia (`id-ID`).
- MediaRecorder untuk merekam suara.

## Test

```bash
bun run test:unit  # unit test dengan Vitest
bun run test:e2e   # end-to-end test dengan Playwright
```

## Deploy

Deploy otomatis ke Cloudflare Pages melalui GitHub Actions saat push ke branch `main`.
Tambahkan repository secrets berikut di GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME` (opsional, default `tepuq`)

## Catatan

- Data tersimpan di browser masing-masing. Gunakan export/import untuk backup.
- Suara TTS paling baik di Chrome/Edge. Firefox terkadang membutuhkan interaksi pengguna dulu sebelum audio bisa berjalan.
- Lihat `AGENTS.md` untuk panduan kontributor dan agent.
