import type { IconName } from "@editor/ui/Icon";
import type { ToolId } from "@editor/types/toolId";

export type FeatureCategoryId =
  | "all"
  | "organize"
  | "convert"
  | "edit"
  | "security"
  | "ocr"
  | "automate";

export interface FeatureCategoryTab {
  id: FeatureCategoryId;
  label: string;
  count: number;
}

export interface SirisoFeatureItem {
  id: string;
  code: string;
  category: Exclude<FeatureCategoryId, "all">;
  categoryLabel: string;
  title: string;
  subtitle: string;
  description: string;
  icon: IconName;
  toolId: ToolId;
  highlights: string[];
  badge?: string;
}

export interface QuickLaunchTool {
  id: string;
  label: string;
  sublabel: string;
  icon: IconName;
  toolId: ToolId;
}

export interface ArchitecturePod {
  index: string;
  tag: string;
  metric: string;
  title: string;
  description: string;
  specs: string[];
  icon: IconName;
}

export interface WorkflowStep {
  step: string;
  phase: string;
  title: string;
  description: string;
  badge: string;
  icon: IconName;
}

export interface SirisoFaqItem {
  num: string;
  question: string;
  answer: string;
}

export const QUICK_LAUNCH_TOOLS: QuickLaunchTool[] = [
  {
    id: "merge",
    label: "Gabung PDF",
    sublabel: "Satukan banyak file",
    icon: "merge",
    toolId: "merge",
  },
  {
    id: "split",
    label: "Pisah Halaman",
    sublabel: "Ekstrak rentang halaman",
    icon: "split",
    toolId: "split",
  },
  {
    id: "compress",
    label: "Kompres PDF",
    sublabel: "Perkecil ukuran file",
    icon: "shrink",
    toolId: "compress",
  },
  {
    id: "convert",
    label: "Siriso Office Convert",
    sublabel: "Word, Excel, PPT & Gambar",
    icon: "file-convert",
    toolId: "convert",
  },
  {
    id: "pdfTextEditor",
    label: "Edit Teks PDF",
    sublabel: "Ubah teks langsung di halaman",
    icon: "file-pen",
    toolId: "pdfTextEditor",
  },
  {
    id: "sign",
    label: "Tanda Tangan",
    sublabel: "Visual & sertifikat digital",
    icon: "signature",
    toolId: "sign",
  },
  {
    id: "ocr",
    label: "OCR Dokumen Scan",
    sublabel: "Jadikan teks bisa dicari",
    icon: "scan-text",
    toolId: "ocr",
  },
  {
    id: "multiTool",
    label: "Editor Multi-Halaman",
    sublabel: "Susun, putar & hapus visual",
    icon: "layout-grid",
    toolId: "multiTool",
  },
];

export const FEATURE_CATEGORIES: FeatureCategoryTab[] = [
  { id: "all", label: "Semua Fitur Utama", count: 12 },
  { id: "organize", label: "Organisasi Halaman", count: 3 },
  { id: "convert", label: "Konversi & Office", count: 2 },
  { id: "edit", label: "Edit & Kanvas", count: 3 },
  { id: "security", label: "Keamanan & Tanda Tangan", count: 2 },
  { id: "ocr", label: "OCR & Optimasi", count: 1 },
  { id: "automate", label: "Otomatisasi", count: 1 },
];

export const SIRISO_FEATURES: SirisoFeatureItem[] = [
  {
    id: "feat-merge-split",
    code: "MOD // 01",
    category: "organize",
    categoryLabel: "Organisasi Halaman",
    title: "Gabung & Pisah PDF Presisi Tinggi",
    subtitle: "Merge, Split & Extract Pages",
    description:
      "Satukan puluhan dokumen PDF menjadi satu bundel terstruktur atau pisahkan halaman tertentu berdasarkan rentang, penanda bab, maupun ukuran berkas tanpa mengubah tata letak asli.",
    icon: "merge",
    toolId: "merge",
    highlights: ["Drag-and-drop urutan file", "Pemisahan per rentang halaman", "Pertahankan bookmark & daftar isi"],
    badge: "POPULER",
  },
  {
    id: "feat-office-convert",
    code: "MOD // 02",
    category: "convert",
    categoryLabel: "Konversi & Office",
    title: "Siriso Office Convert & Multi-Format",
    subtitle: "Word, Excel, PowerPoint, Gambar & PDF/A",
    description:
      "Konversi dua arah antara PDF dan format kerja harian: ubah PDF ke Word (.docx), Excel, PowerPoint, PNG/WEBP resolusi tinggi, HTML, Markdown, atau ubah dokumen Office menjadi PDF standar arsip.",
    icon: "file-convert",
    toolId: "convert",
    highlights: ["PDF ke Word, Excel & PPT", "Word/Excel/PPT ke PDF", "Ekspor gambar DPI tinggi & PDF/A"],
    badge: "UNGGULAN",
  },
  {
    id: "feat-text-editor",
    code: "MOD // 03",
    category: "edit",
    categoryLabel: "Edit & Kanvas",
    title: "Editor Teks PDF & Anotasi Langsung",
    subtitle: "Direct Canvas Text & Object Editing",
    description:
      "Edit paragraf, perbaiki salah ketik, ganti tipografi, geser elemen gambar, dan tambahkan anotasi maupun penanda warna langsung di atas kanvas dokumen PDF Anda secara interaktif.",
    icon: "file-pen",
    toolId: "pdfTextEditor",
    highlights: ["Ubah teks langsung di halaman", "Sisipkan gambar & bentuk", "Penggaris & panduan presisi"],
    badge: "KANVAS",
  },
  {
    id: "feat-compress",
    code: "MOD // 04",
    category: "ocr",
    categoryLabel: "OCR & Optimasi",
    title: "Kompresi Pintar & OCR Multi-Bahasa",
    subtitle: "Smart Compression & Optical Character Recognition",
    description:
      "Perkecil ukuran file PDF secara drastis untuk lampiran email atau portal unggahan tanpa mengaburkan ketajaman huruf, serta kenali teks dari hasil scan menggunakan mesin OCR akurat.",
    icon: "shrink",
    toolId: "compress",
    highlights: ["Rasio kompresi terukur", "OCR dokumen hasil pindaian", "Perbaikan PDF rusak (Repair)"],
  },
  {
    id: "feat-signature",
    code: "MOD // 05",
    category: "security",
    categoryLabel: "Keamanan & Tanda Tangan",
    title: "Tanda Tangan Digital & Sertifikat X.509",
    subtitle: "Wet Signature, Certificate Sign & Verification",
    description:
      "Bubuhkan tanda tangan goresan tangan, unggah spesimen tanda tangan, atau tandatangani dokumen secara kriptografis menggunakan sertifikat PKCS#12 (.p12/.pfx) lengkap dengan fitur verifikasi keaslian.",
    icon: "signature",
    toolId: "sign",
    highlights: ["Goresan langsung atau QR HP", "Sertifikat digital .p12 / .pfx", "Validasi tanda tangan resmi"],
    badge: "KRIPTOGRAFI",
  },
  {
    id: "feat-security-redact",
    code: "MOD // 06",
    category: "security",
    categoryLabel: "Keamanan & Tanda Tangan",
    title: "Enkripsi AES-256, Redaksi & Sanitasi",
    subtitle: "Password Protection, Permanent Redaction & Sanitize",
    description:
      "Kunci dokumen rahasia dengan enkripsi kata sandi, atur izin cetak/salin, hapus metadata tersembunyi, atau sensor permanen (Redaction) data pribadi hingga tidak dapat dipulihkan.",
    icon: "shield-check",
    toolId: "redact",
    highlights: ["Enkripsi & buka kunci sandi", "Redaksi permanen teks sensitif", "Pembersihan metadata & skrip"],
  },
  {
    id: "feat-multitool",
    code: "MOD // 07",
    category: "organize",
    categoryLabel: "Organisasi Halaman",
    title: "Meja Kerja Multi-Tool Halaman Visual",
    subtitle: "Interactive Page Grid Organizer",
    description:
      "Kelola ratusan halaman sekaligus dalam tampilan kisi visual: putar halaman, sisipkan dokumen lain di tengah halaman, gandakan, pisahkan, atau hapus halaman kosong dalam satu layar.",
    icon: "layout-grid",
    toolId: "multiTool",
    highlights: ["Pratinjau thumbnail instan", "Putar & susun ulang massal", "Hapus halaman kosong otomatis"],
  },
  {
    id: "feat-forms",
    code: "MOD // 08",
    category: "edit",
    categoryLabel: "Edit & Kanvas",
    title: "Pengisian Formulir & Deteksi Kolom Otomatis",
    subtitle: "Interactive PDF Form Fill & Field Detection",
    description:
      "Isi kolom formulir PDF interaktif dengan cepat, deteksi area isian secara otomatis pada formulir datar, atau kunci formulir (Flatten) agar isian tidak dapat diubah kembali oleh penerima.",
    icon: "form-input",
    toolId: "formFill",
    highlights: ["Deteksi kolom formulir", "Isian teks, kotak centang & tanggal", "Flatten formulir menjadi permanen"],
  },
  {
    id: "feat-watermark-stamp",
    code: "MOD // 09",
    category: "edit",
    categoryLabel: "Edit & Kanvas",
    title: "Watermark, Stempel Resmi & Nomor Halaman",
    subtitle: "Custom Watermark, Stamp & Bates Numbering",
    description:
      "Lindungi hak cipta dokumen perusahaan dengan watermark teks atau logo transparan, tambahkan stempel persetujuan di posisi presisi, dan beri penomoran halaman otomatis.",
    icon: "watermark",
    toolId: "watermark",
    highlights: ["Watermark teks & gambar logo", "Pengaturan opasitas & rotasi", "Penomoran halaman kustom"],
  },
  {
    id: "feat-compare",
    code: "MOD // 10",
    category: "convert",
    categoryLabel: "Konversi & Office",
    title: "Bandingkan Revisi Dokumen (Compare PDF)",
    subtitle: "Visual Pixel & Text Diff Inspection",
    description:
      "Temukan setiap perubahan antara dua versi kontrak atau laporan secara berdampingan. Sorot perbedaan teks maupun perubahan visual piksel demi akurasi audit dokumen.",
    icon: "image-compare",
    toolId: "compare",
    highlights: ["Perbandingan teks & piksel", "Sorotan perubahan warna", "Navigasi antar titik revisi"],
  },
  {
    id: "feat-layout-booklet",
    code: "MOD // 11",
    category: "organize",
    categoryLabel: "Organisasi Halaman",
    title: "Tata Letak Multi-Halaman, Crop & Buklet",
    subtitle: "Page Layout, Margin Crop & Booklet Imposition",
    description:
      "Susun beberapa halaman PDF ke dalam satu lembar cetak (N-up), potong margin berlebih secara presisi, ubah skala ukuran kertas (A4, Letter, Legal), atau buat susunan cetak buklet.",
    icon: "crop",
    toolId: "crop",
    highlights: ["Potong margin (Crop) visual", "Cetak N-up & buklet lipat", "Penyesuaian skala ukuran kertas"],
  },
  {
    id: "feat-automate",
    code: "MOD // 12",
    category: "automate",
    categoryLabel: "Otomatisasi",
    title: "Pipeline Otomatisasi Berantai",
    subtitle: "Multi-Step PDF Workflow Automation",
    description:
      "Rangkai beberapa operasi PDF menjadi satu alur kerja otomatis yang dapat disimpan dan dijalankan berulang kali—misalnya: OCR Scan → Kompres Ukuran → Tambah Watermark → Kunci Sandi.",
    icon: "workflow",
    toolId: "automate",
    highlights: ["Rangkaian operasi tanpa batas", "Simpan preset alur kerja", "Pemrosesan batch banyak file"],
    badge: "PIPELINE",
  },
];

export const ARCHITECTURE_PODS: ArchitecturePod[] = [
  {
    index: "01 // WORKFLOW",
    tag: "STATEFUL ENGINE",
    metric: "0x Reload",
    title: "Rantai Alat Tanpa Unggah Ulang",
    description:
      "Unggah PDF sekali, lalu berpindah dari Pisah Halaman ke Edit Teks, Kompresi, hingga Tanda Tangan tanpa perlu mengunduh dan mengunggah ulang di setiap tahap.",
    specs: ["IndexedDB Cache", "Web Worker Render", "100GB+ Stream Ready"],
    icon: "layers",
  },
  {
    index: "02 // PRIVACY",
    tag: "ZERO LEAKAGE",
    metric: "AES-256",
    title: "Privasi Dokumen & Keamanan Tingkat Enterprise",
    description:
      "Dirancang untuk dokumen sensitif bisnis dan hukum: dilengkapi fitur Redaksi Permanen, Sanitasi Metadata, serta dukungan eksekusi lokal maupun offline penuh di versi Desktop.",
    specs: ["X.509 PKCS#12", "Permanent Redact", "Metadata Sanitizer"],
    icon: "shield-check",
  },
  {
    index: "03 // CONVERSION",
    tag: "SIRISO ENGINE",
    metric: "50+ Alat",
    title: "Konversi Presisi & Mesin PDF Hibrida",
    description:
      "Menggabungkan kekuatan PDFBox, PDFium, dan Siriso Office Convert untuk memastikan tabel, rumus, grafik, dan tipografi tetap rapi saat dikonversi.",
    specs: ["Siriso Office Convert", "PDF/A Archival", "Multi-Language OCR"],
    icon: "cpu",
  },
  {
    index: "04 // ECOSYSTEM",
    tag: "WEB + DESKTOP",
    metric: "Dual Mode",
    title: "Akses Instan di Browser & Aplikasi Desktop Windows",
    description:
      "Gunakan langsung dari peramban web di perangkat apa pun, atau aktifkan Paket Pro untuk mengunduh Siriso PDF Desktop Windows x64 yang berjalan 100% offline.",
    specs: ["Web Instant Access", "Windows x64 Native", "Bebas Iklan (Pro)"],
    icon: "monitor",
  },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: "01",
    phase: "LANGKAH 01 // INPUT",
    title: "Pilih Alat atau Jatuhkan Dokumen PDF",
    description:
      "Tarik berkas PDF langsung ke kotak peluncur di halaman ini atau pilih salah satu dari 50+ alat spesifik sesuai tugas dokumen Anda.",
    badge: "Instan & Tanpa Registrasi",
    icon: "file-up",
  },
  {
    step: "02",
    phase: "LANGKAH 02 // PROSES",
    title: "Atur Parameter dengan Pratinjau Visual",
    description:
      "Susun halaman secara drag-and-drop, ketik revisi teks langsung di kanvas, atur tingkat kompresi, atau tempatkan tanda tangan dengan presisi penuh.",
    badge: "Pratinjau Real-Time",
    icon: "sliders-horizontal",
  },
  {
    step: "03",
    phase: "LANGKAH 03 // OUTPUT",
    title: "Lanjutkan ke Alat Berikutnya atau Unduh",
    description:
      "Unduh hasil dokumen yang telah selesai diproses seketika, atau langsung teruskan ke alat PDF lain dalam satu sesi kerja yang berkesinambungan.",
    badge: "Multi-Tool Chaining",
    icon: "download",
  },
];

export const SIRISO_FAQS: SirisoFaqItem[] = [
  {
    num: "01",
    question: "Apa itu Siriso PDF dan apa hubungannya dengan Siriso Lab?",
    answer:
      "Siriso PDF adalah platform pengolahan, pengeditan, konversi, dan keamanan dokumen PDF terpadu yang dikembangkan oleh Siriso Lab (sirisolab.com). Seluruh antarmuka dirancang agar cepat, intuitif, dan memiliki kapabilitas lengkap mulai dari penggabungan halaman hingga tanda tangan sertifikat kriptografi.",
  },
  {
    num: "02",
    question: "Apakah Siriso PDF bisa digunakan secara gratis di web?",
    answer:
      "Ya. Anda dapat langsung menggunakan alat-alat PDF di versi web secara gratis tanpa dipaksa membuat akun terlebih dahulu. Versi gratis didukung oleh tayangan iklan ringan agar layanan tetap dapat diakses oleh semua pengguna.",
  },
  {
    num: "03",
    question: "Apa saja keuntungan berlangganan Siriso PDF Paket Pro (Rp 25.000 / bulan)?",
    answer:
      "Dengan Paket Pro seharga Rp 25.000 per bulan, seluruh iklan di antarmuka web otomatis dihilangkan (100% Bebas Iklan), Anda mendapatkan akses penuh ke seluruh fitur konversi & otomatisasi, serta hak unduh eksklusif aplikasi Siriso PDF Desktop untuk Windows (x64) yang dapat dijalankan secara offline.",
  },
  {
    num: "04",
    question: "Bagaimana cara kerja fitur Siriso Office Convert dan OCR?",
    answer:
      "Siriso Office Convert memproses perubahan dokumen Word (.docx), Excel (.xlsx), dan PowerPoint (.pptx) ke PDF maupun sebaliknya dengan menjaga struktur tata letak. Sedangkan fitur OCR (Optical Character Recognition) memindai gambar teks pada PDF hasil scan sehingga teksnya dapat dicari (Ctrl+F), disorot, dan disalin.",
  },
  {
    num: "05",
    question: "Apakah dokumen PDF saya aman saat diproses di Siriso PDF?",
    answer:
      "Keamanan dokumen adalah prioritas utama. Operasi tampilan dan manipulasi kanvas memanfaatkan pemrosesan memori lokal peramban, sementara pemrosesan mesin tidak menyimpan dokumen Anda untuk pihak ketiga. Anda juga dapat menggunakan fitur Sanitasi Metadata, Redaksi Permanen, dan Enkripsi Sandi AES-256.",
  },
  {
    num: "06",
    question: "Bisakah saya mengolah beberapa tahap sekaligus tanpa upload ulang?",
    answer:
      "Bisa. Arsitektur Stateful Multi-Tool di Siriso PDF menyimpan dokumen aktif di sesi meja kerja Anda. Setelah selesai memotong atau menggabungkan halaman, Anda cukup memilih alat berikutnya (misalnya Kompres atau Tanda Tangan) dan file hasil sebelumnya langsung siap diproses.",
  },
];

