# TepuQ & TariQ

TepuQ & TariQ adalah permainan browser sederhana untuk anak 15 bulan ke atas yang belajar mengenal objek, suara, kata, dan koordinasi tangan–penglihatan. "TepuQ" berarti *tap* (ketuk) dan "TariQ" berarti *drag* (tarik).

Halaman utama menampilkan **Game Picker** — menu untuk memilih salah satu dari dua game:

- **TepuQ Gambar** — permainan kartu foto dengan dua mode bermain:
  - **TepuQ Bebas** — anak menekan tombol keyboard atau mengetuk layar mana saja. Kartu foto muncul dengan suara.
  - **TepuQ Target** — anak harus mengetuk kartu fotonya untuk melanjutkan ke objek berikutnya.
- **TariQ Kata** — permainan mengeja: sebuah kata tampil sebagai kotak-kotak huruf kosong dengan fotonya, dan anak menyeret huruf-huruf yang tersebar ke kotak yang tepat. Huruf yang benar menempel dan berubah hijau; menyelesaikan sesi menampilkan layar kemenangan.

## Cara Menjalankan di Lokal

Butuh [Bun](https://bun.sh/) yang sudah terinstall.

```bash
bun install        # install dependencies
bun run dev        # dev server di http://localhost:5173
bun run build      # build static site ke dist/
bun run preview    # preview build production
```

Buka di browser:

- Bermain: `http://localhost:5173`
- Admin: `http://localhost:5173?mode=admin`

## Fitur Admin

- Tambah, edit, hapus objek.
- Upload foto dari file atau muat dari URL.
- Rekam suara sendiri dengan toggle untuk menggantikan TTS.
- Atur warna, animasi muncul, dan ukuran kartu.
- Atur gaya latar belakang, mode putar, jendela burst, dan lama kartu tampil.
- Atur kecepatan, pitch, dan volume suara TTS Bahasa Indonesia.
- Atur tombol cepat (key binding) untuk objek tertentu.
- Atur mode yang tersedia dan mode layar penuh.
- Atur toggle "Aktif di TepuQ Gambar" per objek untuk memilih objek mana yang menjadi gambar di TepuQ Gambar.
- Atur toggle "Aktif di TariQ Kata" per objek untuk memilih objek mana yang menjadi kata di TariQ Kata.
- Atur pengaturan TariQ Kata: ukuran huruf/kotak, jarak snap, dan panjang sesi.
- Export data ke ZIP (`tepuq-data.zip`) untuk backup.
- Import ZIP untuk memindahkan data antar browser atau perangkat.

## Sinkron Cloud (Opsional)

Keluarga bisa login dengan username dan password bersama untuk menyimpan objek custom dan pengaturan ke cloud, lalu menggunakannya di perangkat lain. Sinkron ini opsional; semua data lokal tetap tersimpan di browser masing-masing.

Sinkron cloud menggunakan Cloudflare Pages Functions + KV. Lihat `AGENTS.md` untuk detail konfigurasi secrets.

## Teknologi

- Vite untuk build dan dev server.
- Vanilla JavaScript + HTML + CSS, tanpa framework eksternal.
- IndexedDB untuk penyimpanan lokal browser.
- JSZip dan FileSaver untuk export/import.
- Web Speech API untuk suara Bahasa Indonesia (`id-ID`).
- MediaRecorder untuk merekam suara.
- Cloudflare Pages Functions + KV untuk sinkron cloud opsional.

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

Jika ingin mengaktifkan sinkron cloud, tambahkan juga:

- `TEPUQ_USER` — username keluarga untuk sinkron.
- `TEPUQ_PASS` — password keluarga untuk sinkron.
- `TEPUQ_JWT_SECRET` — secret acak panjang untuk menandai JWT.

## Catatan

- Data tersimpan di browser masing-masing. Gunakan export/import untuk backup.
- Suara TTS paling baik di Chrome/Edge. Firefox terkadang membutuhkan interaksi pengguna dulu sebelum audio bisa berjalan.
- Lihat `docs/architecture.md` untuk arsitektur teknis, dan `AGENTS.md` untuk panduan kontributor dan agent.
