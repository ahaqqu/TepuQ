# TepuQ

TepuQ adalah permainan browser sederhana untuk anak 15 bulan ke atas yang belajar mengenal objek, suara, dan koordinasi tangan–penglihatan.

## Dua Mode Bermain

- **TepuQ Bebas** — anak menekan tombol keyboard atau mengetuk layar mana saja. Kartu foto muncul dengan suara.
- **TepuQ Target** — anak harus mengetuk kartu fotonya untuk melanjutkan ke objek berikutnya.

## Cara Menjalankan di Lokal

```bash
./run-local.sh
```

Buka di browser:

- Bermain: `http://localhost:8080`
- Admin: `http://localhost:8080?mode=admin`

## Fitur Admin

- Tambah, edit, hapus objek.
- Upload foto untuk setiap objek.
- Atur warna tema dan animasi kartu.
- Atur kecepatan, pitch, dan volume suara TTS Bahasa Indonesia.
- Export data ke ZIP (`tepuq-data.zip`) untuk backup.
- Import ZIP untuk memindahkan data antar browser atau perangkat.

## Teknologi

- Satu file `index.html` berisi HTML, CSS, dan JavaScript.
- Tanpa framework eksternal.
- IndexedDB untuk penyimpanan lokal browser.
- JSZip dan FileSaver untuk export/import.
- Web Speech API untuk suara Bahasa Indonesia (`id-ID`).

## Catatan

- Data tersimpan di browser masing-masing. Gunakan export/import untuk backup.
- Suara TTS paling baik di Chrome/Edge. Firefox terkadang membutuhkan interaksi pengguna dulu sebelum audio bisa berjalan.
