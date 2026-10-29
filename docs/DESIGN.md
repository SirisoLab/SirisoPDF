# Sistem Desain Siriso PDF (Landing Page & Workspace)

## 1. Tujuan Visual & Identitas Produk
Siriso PDF mengusung identitas visual **Obsidian & Siriso Orange** yang terinspirasi dari studio induk **Siriso Lab** (`sirisolab.com`), namun dioptimalkan khusus sebagai aplikasi produktivitas dokumen profesional:
- **Tanpa Scroll-Jacking**: Berbeda dari situs portofolio agensi yang menggunakan mask scroll panjang, halaman muka (*Landing Page*) Siriso PDF langsung menampilkan proposisi nilai, *Interactive PDF Dropzone*, akses instan ke 50+ alat PDF, serta penjelasan mendalam fitur-fitur utama.
- **Kontras Tinggi & Keterbacaan**: Latar belakang hitam karbon (`--p-zinc-950`, `--p-zinc-900`, `--p-black`) dipadukan dengan teks putih hangat (`--p-snow`, `--p-zinc-200`) dan aksen **Siriso Orange** (`--p-siriso-orange-500` untuk sorotan visual, `--p-siriso-orange-400` untuk teks aksen di latar gelap, dan `--p-siriso-orange-600` untuk tombol interaktif).

## 2. Hierarki Tipografi
- **Display & Judul Bagian**: `Syne` (bobot 700–800, *letter-spacing* `-0.03em`) dari berkas font lokal `Syne-Variable.ttf`, digunakan pada judul Hero, nomor indeks bagian `(01)`–`(05)`, dan metrik utama.
- **Teks Antarmuka & Penjelasan Fitur**: Sans-serif sistem / `Inter` (ukuran dasar `1rem` / `16px`, *line-height* `1.6`) agar nyaman dibaca pada penjelasan teknis fitur PDF.
- **Label Teknis & Spesifikasi Engine**: Monospace (`JetBrains Mono`, `ui-monospace`) huruf kapital dengan *letter-spacing* `0.08em` untuk tag arsitektur (`SIRISO OFFICE ENGINE`, `AES-256`, `PDFBOX CORE`, `LOCAL & PRIVATE`).

## 3. Token Semantik & Palet Warna
Seluruh komponen wajib mereferensikan token CSS dari `primitives.css` dan `colors.css` tanpa warna `#hex` mentah di luar `primitives.css`:
- **Permukaan (Surfaces)**:
  - Canvas utama: `var(--p-zinc-950)` dan `var(--p-black)`
  - Kartu fitur & panel interaktif: `var(--p-zinc-900)` hingga `var(--p-zinc-850)`
  - Hover permukaan: `var(--p-zinc-800)`
- **Teks**:
  - Utama: `var(--p-snow)`
  - Sekunder: `var(--p-zinc-200)`
  - Redup / Metadata: `var(--p-zinc-250)`
- **Aksen & Brand (Jingga & Hitam)**:
  - Sorotan utama: `var(--p-siriso-orange-500)`
  - Kontrol primer: `var(--p-siriso-orange-600)`
  - Teks aksen di atas latar hitam: `var(--p-siriso-orange-400)`
  - Tint halus: `color-mix(in srgb, var(--p-siriso-orange-500) 14%, transparent)`
  - Garis batas (*border*) aksen: `color-mix(in srgb, var(--p-siriso-orange-500) 38%, transparent)`

## 4. Struktur Komponen Landing Page (`SirisoLandingPage`)
1. **Header Navigasi Mengambang (`header.siriso-lp-header`)**:
   - Identitas logo cincin jingga `SirisoLogo.png` + wordmark `SIRISO PDF` + lencana `BY SIRISOLAB.COM`.
   - Tautan jangkar (*anchor*): Fitur Utama, Katalog Alat, Keunggulan Engine, Paket Pro, dan FAQ.
   - Tombol aksi cepat: **Paket Pro** (membuka `SirisoProModal`) dan **Buka Workspace PDF** (masuk ke aplikasi utama).
2. **Hero Stage & Quick-Start Dropzone**:
   - Kolom kiri: Headline utama, ringkasan kemampuan Siriso PDF, tombol **Buka Workspace PDF**, **Unggah & Buka PDF**, serta indikator kapabilitas.
   - Kolom kanan: Panel interaktif *Drag & Drop PDF* yang terhubung langsung ke `FileContext` (`addFiles`) sehingga pengguna dapat menjatuhkan berkas PDF di halaman depan dan langsung masuk ke editor dengan berkas siap diolah, dilengkapi 8 pintasan alat terpopuler.
3. **Eksplorasi 6 Pilar Fitur Siriso PDF (Dengan Filter Kategori Interaktif)**:
   - Filter kategori: *Semua Fitur*, *Organisasi Halaman*, *Konversi & Office*, *Edit & Anotasi*, *Keamanan & Tanda Tangan*, *OCR & Optimasi*, *Otomatisasi*.
   - Setiap kartu menjelaskan fungsi teknis fitur, tag kemampuan, dan tombol **Buka Alat Ini** yang langsung mengaktifkan alat terkait di `ToolWorkflowContext`.
4. **Arsitektur & Keunggulan Siriso PDF**:
   - 4 pod spesifikasi teknis: *Multi-Tool Chaining Tanpa Reload*, *Siriso Office Convert Engine*, *Keamanan & Redaksi Kriptografis*, dan *Dukungan File Besar & Desktop Offline*.
5. **Alur Kerja 3 Langkah & Perbandingan Paket (Gratis vs Paket Pro Rp 25.000/bln)**:
   - Penjelasan transparan paket Web Gratis dan Paket Pro (Bebas Iklan + Unduh Aplikasi Desktop Windows x64).
6. **FAQ & Footer Ekosistem Siriso Lab**:
   - Daftar pertanyaan umum interaktif (`<details>`) dan footer dengan tautan langsung ke alat-alat utama serta `sirisolab.com`.

## 5. Perilaku Responsif & Aksesibilitas
- **Desktop (>= 1200px)**: Tata letak Hero 2 kolom asimetris, grid fitur 3 kolom, pod arsitektur 4 kolom.
- **Tablet (768px – 1199px)**: Tata letak Hero bertumpuk dengan panel Dropzone lebar penuh, grid fitur 2 kolom.
- **Mobile (< 768px)**: Navigasi disederhanakan dengan menu ringkas, tombol CTA lebar penuh yang mudah dijangkau jari, dan grid 1 kolom tanpa *horizontal overflow*.
- **States Lengkap**: Hover, focus-visible dengan cincin jingga (`var(--p-siriso-orange-400)`), drag-over state pada Dropzone, status aktif Paket Pro, serta dukungan `prefers-reduced-motion`.

