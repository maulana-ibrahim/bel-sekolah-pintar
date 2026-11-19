# 🔔 Bel Sekolah Pintar

[![Rilis terbaru](https://img.shields.io/github/v/release/maulana-ibrahim/bel-sekolah-pintar?label=rilis)](https://github.com/maulana-ibrahim/bel-sekolah-pintar/releases/latest)
[![Lisensi MIT](https://img.shields.io/badge/lisensi-MIT-blue)](LICENSE)
![Windows 10/11](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4)

Aplikasi bel sekolah otomatis untuk Windows: gratis, open source, dan **berjalan tanpa internet**.
Atur jadwal bel sekali, lalu biarkan aplikasi membunyikannya tepat waktu lewat speaker atau sistem PA sekolah,
bahkan saat jendelanya ditutup ke system tray.

*An offline, open-source school bell scheduler for Windows (UI in Indonesian). Developer notes in English are [below](#for-developers).*

---

## Fitur

- **Jadwal per template**: buat template berbeda, misalnya Reguler, Jumat, Ujian, atau Ramadhan, lalu aktifkan salah satunya dengan sekali klik.
- **Bel per hari**: setiap bel punya jam, label, hari aktif (Senin–Minggu), dan suara sendiri.
- **Cegah bentrok**: aplikasi menolak dua bel di jam dan hari yang sama dalam satu template.
- **Jenis bel berwarna**: Masuk, Istirahat, Ibadah, Pulang, atau jenis buatan sendiri, dengan warna penanda yang bebas dipilih.
- **Galeri suara**: tambahkan file `.mp3` atau `.wav` sendiri. File disalin ke folder aplikasi, jadi aman walau file aslinya dihapus.
- **Bel manual**: tombol darurat di Dasbor (misalnya Bel Darurat atau Upacara) untuk membunyikan bel kapan saja.
- **Pilih speaker**: arahkan bel ke speaker atau PA tertentu. Kalau speaker itu dicabut, bel otomatis pindah ke speaker bawaan.
- **Jalan di latar belakang**: menutup jendela hanya menyembunyikannya ke tray, dan bel tetap berbunyi.
- **Mulai otomatis** saat Windows login, langsung tersembunyi di tray.
- **Tidak pernah telat**: bel yang terlewat karena PC tidur dilewati, bukan dibunyikan terlambat.

## Unduh & pasang

1. Buka halaman **[Rilis terbaru](https://github.com/maulana-ibrahim/bel-sekolah-pintar/releases/latest)**.
2. Unduh **`Bel.Sekolah.Pintar_x.y.z_x64-setup.exe`**, lalu jalankan.
3. Installer belum ditandatangani digital, jadi Windows SmartScreen mungkin menampilkan
   *"Windows protected your PC"*. Klik **More info** lalu **Run anyway**.

| File | Untuk |
|---|---|
| `…-setup.exe` | Satu PC. Tidak perlu admin; dipasang untuk akun yang sedang login. **Disarankan.** |
| `….msi` | Staf IT yang memasang ke banyak PC (semua akun, butuh admin; bisa lewat Group Policy/Intune). |

Butuh Windows 10 atau 11 (64-bit). WebView2 dipasang otomatis oleh installer jika belum ada.

## Cara pakai

1. **Galeri Suara**: tambahkan suara bel. Satu suara bawaan, *Bel Default.wav*, sudah tersedia.
2. **Jadwal**: pilih template "Reguler", lalu klik **Tambah bel**. Isi jam, label, jenis, hari, dan suara.
3. Buat template lain jika perlu (misalnya "Jumat"), lalu klik **Jadikan aktif** pada template yang sedang dipakai.
4. **Pengaturan**: pilih speaker atau PA, klik **Tes suara**, dan nyalakan **Jalan otomatis**.
5. Tutup jendela. Aplikasi tetap berjalan di tray (ikon lonceng kuning di pojok kanan bawah).

## Agar bel selalu berbunyi

Aplikasi hanya bisa membunyikan bel saat PC **menyala dan sudah login**. Di PC bel:

- **Power Plan**: atur *Sleep* ke **Never**.
- **Auto-login Windows**: aktifkan, supaya setelah listrik padam dan PC menyala lagi, aplikasi ikut berjalan tanpa perlu ada yang login.
- **Pengaturan → Jalan otomatis**: nyalakan.

Kalau ada bel yang gagal berbunyi, misalnya karena speaker bermasalah, alasannya tercatat di
`%APPDATA%\id.sch.belsekolahpintar\bel.log`.

## Data & cadangan

Semua data tersimpan di PC, di folder `%APPDATA%\id.sch.belsekolahpintar\`:

- `data.json`: template, bel, jenis bel, tombol manual, dan pengaturan
- `sounds\`: file suara
- `bel.log`: catatan bel yang gagal

**Mencadangkan / memindahkan ke PC lain:** tutup aplikasi lewat tray → *Keluar*, salin seluruh folder di atas ke folder yang sama di PC tujuan, lalu buka aplikasi.

Data per akun Windows: atur jadwal di akun yang dipakai untuk auto-login.

## Pertanyaan umum

**Butuh internet atau server?** Tidak. Semuanya berjalan di dalam satu aplikasi di PC sekolah.

**Bisa dipakai di Mac atau Linux?** Saat ini hanya Windows yang dirilis. Kodenya berbasis Tauri, jadi
port ke Mac/Linux dimungkinkan. Kontribusi dipersilakan.

**Menemukan bug atau punya ide?** Buka [Issue](https://github.com/maulana-ibrahim/bel-sekolah-pintar/issues).

---

## For developers

A [Tauri v2](https://tauri.app) app: the UI is React, and the bell engine is Rust **inside the same
process**. No server, no network: the UI talks to Rust through Tauri's in-process IPC.

```
Bel Sekolah Pintar.exe
├─ Rust (src-tauri/src)
│   ├─ scheduler.rs  checks the clock every second; rings each minute at most once,
│   │                skips minutes missed during sleep (never rings late)
│   ├─ audio.rs      rodio playback on a dedicated thread, chosen device → default fallback
│   ├─ data.rs       data.json store, atomic writes (temp + fsync + rename), corrupt-file backup
│   ├─ sounds.rs     sound folder: import (copy + dedupe), list with size/duration, path guard
│   └─ lib.rs        commands, tray, single instance, autostart (--minimized), bel.log
└─ WebView2 UI (src)
    ├─ lib/data.ts     data types + pure edit/validation rules (clashes, unique names/colors…)
    ├─ lib/api.ts      typed wrappers for the Rust commands
    ├─ screens/        Dasbor, Jadwal, Jenis Bel, Galeri Suara, Pengaturan
    └─ components/     "Krayon" design system on Tailwind v4 + shadcn/ui
```

**Stack:** Tauri 2 · Rust (rodio, chrono, serde) · React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · Lucide icons.

### Run it

Requires Node 22, pnpm 10 and Rust stable. On Windows you also need the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) (MSVC build tools; WebView2 ships with Windows 10/11).

```bash
pnpm install
pnpm tauri dev    # run the app with hot reload
pnpm test         # TypeScript data rules (node --test) + Rust tests (cargo test)
pnpm tauri build  # local installer build
```

The UI also runs on macOS for development: the scheduler, audio and tray all work.
The speaker list and autostart behave differently there, so check those on Windows.

### Release

Bump `version` in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, then push a tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

[`.github/workflows/build-windows.yml`](.github/workflows/build-windows.yml) runs the tests, builds the
NSIS + MSI installers on `windows-latest`, and publishes them as a GitHub Release.

### Contributing

Issues and pull requests are welcome.

- Keep validation rules in `src/lib/data.ts` (pure functions that throw user-facing Indonesian messages)
  and add a test in `src/lib/data.test.ts`. Rust tests sit next to the code (`#[cfg(test)]`).
- New UI should reuse the components in `src/components` and the color tokens in `src/App.css`.
- UI text is Indonesian; code and comments are English.
- Run `pnpm test` and `pnpm build` before opening a PR.

## License

[MIT](LICENSE) © 2026 maulana-ibrahim and contributors.
