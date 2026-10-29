# Progress Siriso PDF

## Status terakhir (2026-10-28)
- Sedang dikerjakan: Selesai — Landing Page Profesional Siriso PDF (Jingga & Hitam) dan penjelasan fitur lengkap.
- Selesai & terverifikasi:
  - **Siriso PDF Landing Page (`/` & `/welcome`)**:
    - Desain industrial-tech elegan bertema **Jingga & Hitam** (`--p-siriso-orange-*`, `--p-zinc-*`, `--p-black`) yang selaras dengan DNA `sirisolab.com` namun dioptimalkan khusus untuk produk dokumen PDF profesional tanpa scroll-jacking.
    - **Interactive PDF Launchpad** di Hero: Pengunjung dapat langsung *drag-and-drop* / memilih file PDF dari komputer (langsung masuk ke `FileContext` dan membuka *Workspace*), klik tombol **Buka Workspace PDF**, atau memilih salah satu dari 8 pintasan alat populer.
    - **Katalog Penjelasan Fitur Siriso PDF (`sirisoLandingData.ts`)**: 12 modul fitur lengkap dengan filter 6 kategori (*Organisasi Halaman*, *Konversi & Office*, *Edit & Kanvas*, *Keamanan & Tanda Tangan*, *OCR & Optimasi*, *Otomatisasi*), keunggulan *engine* (4 pod arsitektur), panduan 3 langkah kerja, perbandingan *Edisi Web Gratis vs Paket Pro Desktop*, dan akordeon FAQ.
    - **Navigasi Dua Arah**: Pengunjung pertama kali di `/` disambut dengan Landing Page; setelah masuk ke *Workspace*, pengguna dapat kembali ke Landing Page kapan saja melalui tombol **Halaman Utama & Info Fitur** (`data-testid="siriso-landing-button"`) di bilah navigasi kiri (`QuickNavRailFooterExtensions.tsx`).
    - Selama berada di Landing Page, banner iklan komersial dan *popup onboarding* disembunyikan secara otomatis agar tampilan muka bersih dan profesional.
  - **Redesain Dialog Akun & Paket Pro (`SirisoProModal.tsx` & `SirisoProModal.css`) + Sistem Login Akun**:
    - Menghapus seluruh tautan/tombol menuju Backoffice (`/admin`) dari antarmuka publik agar pengunjung tidak dapat mengakses Backoffice.
    - Mengganti mekanisme kode aktivasi di web menjadi **Login / Daftar Akun Pelanggan** (`/api/siriso-pdf/auth/login`, `/api/siriso-pdf/auth/register`, `/api/siriso-pdf/auth/me`, `/api/siriso-pdf/auth/request-upgrade`).
    - Admin cukup mengaktifkan status Pro pada akun email pengguna di Backoffice (`PUT /api/siriso-pdf/users/:id/pro`), dan pengguna web yang login otomatis mendapatkan akses **Paket Pro (100% Bebas Iklan)** tanpa kode aktivasi.
    - **Kode Aktivasi Offline Desktop (`desktopActivationCode`)** hanya ditampilkan pada panel unduhan **Aplikasi Siriso PDF Desktop (Windows x64)** milik akun Pro agar aplikasi desktop dapat digunakan secara offline.
  - Rebranding lengkap antarmuka dan metadata dari Stirling PDF ke Siriso PDF (Wordmark SVG Syne ExtraBold 800, warna primer Siriso Orange, logo ring oranye).
  - Siriso Pro Context & Provider (`SirisoProContext.tsx`, `AppProviders.tsx`).
  - Sticky Ad Banner (`SirisoStickyAdBar.tsx`) pada antarmuka web untuk pengguna non-pro.
  - Siriso Pro Modal (`SirisoProModal.tsx`) dengan aktivasi lisensi, tombol unduh desktop, dan tautan Backoffice.
  - Siriso Pro API di Backoffice Siriso (`C:\Users\itpta\siriso\server.js`):
    - `GET /api/siriso-pdf/config` (Pengaturan iklan & paket harga Rp 25.000 / bulan).
    - `POST /api/siriso-pdf/verify-pro` (Verifikasi lisensi pelanggan dan status aktif).
    - `GET /api/siriso-pdf/download-desktop` (Proteksi download file desktop hanya untuk lisensi aktif).
    - `GET /api/siriso-pdf/admin-data` (Statistik pendapatan, unduhan, dan lisensi aktif).
    - `POST /api/siriso-pdf/subscriptions` (Pembuatan lisensi baru otomatis/manual).
    - `DELETE /api/siriso-pdf/subscriptions/:id` (Pencabutan lisensi).
    - `PUT /api/siriso-pdf/settings` (Pengaturan iklan & tarif).
  - Antarmuka Backoffice Siriso Admin (`C:\Users\itpta\siriso\admin\admin.js`) dengan 2 submenu:
    - Pelanggan & Kunci Lisensi Pro
    - Iklan & Paket Pro
  - Build CEF Desktop Application (`siriso-pdf-cef.zip` 487 MB) via Gradle `packageDesktop` dengan backend JAR terbundle.
  - Build Web Bundle Windows (`Siriso-PDF-web-Windows-x64.zip` 307 MB) via `stirling_native.py package`.
  - Sinkronisasi checksum SHA256 di `outputs\SIRISO-SHA256SUMS.txt`.
  - Perbaikan Blank Screen pada React: Memindahkan `SirisoProProvider` ke `AppFrame.tsx` dan menambahkan `fallbackContext` pada hook `useSirisoPro` sehingga `QuickNavRail` tidak melempar uncaught context error.
  - Verifikasi Tampilan Nyata: Berhasil dirender tanpa error (166 KB DOM) dengan logo Siriso PDF, tools lengkap, dan Sticky Ad Bar Paket Pro (terverifikasi via screenshot headless Chrome).
- Gagal/Blocked: Tidak ada.

## Perintah penting
- Jalankan Siriso Web: `outputs\Buka-Siriso-PDF-Web.cmd`
- Jalankan Backoffice: `node C:\Users\itpta\siriso\server.js` (port 8000)
- Build CEF Launcher: `.\gradlew.bat -p desktop/cef packageDesktop "-PbackendJar=../../dist/native/stirling-pdf.jar"`
- Build Web Bundle: `python scripts/native/stirling_native.py package --output ..\..\outputs\Siriso-PDF-web-Windows-x64.zip`
- Frontend typecheck: `npx tsc --noEmit --project frontend/src/editor/core/tsconfig.json`

## Akun & Lisensi Pengujian
- URL Backoffice Admin: `http://localhost:8000/admin`
- Lisensi Demo Aktif: `SIRISO-PRO-2026-DEMO`
- Tarif Pro: Rp 25.000 / bulan

## Nanti (ide di luar cakupan)
- Integrasi payment gateway otomatis (Midtrans / Xendit) untuk pembayaran QRIS / VA langsung dari web UI Siriso PDF.
- Auto-updater untuk client CEF desktop.
