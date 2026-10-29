import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@editor/ui/Icon";
import { useSirisoPro } from "@editor/contexts/SirisoProContext";
import { useSuppressQuickNavRail } from "@editor/contexts/QuickNavHostContext";
import { useToolWorkflow } from "@editor/contexts/ToolWorkflowContext";
import { useFileActions } from "@editor/contexts/file/fileHooks";
import type { ToolId } from "@editor/types/toolId";
import sirisoLogoUrl from "@editor/assets/brand/modern-logo/SirisoLogo.png";
import {
  ARCHITECTURE_PODS,
  FEATURE_CATEGORIES,
  FeatureCategoryId,
  QUICK_LAUNCH_TOOLS,
  SIRISO_FAQS,
  SIRISO_FEATURES,
  WORKFLOW_STEPS,
} from "@editor/components/shared/siriso/sirisoLandingData";
import "@editor/components/shared/siriso/SirisoLandingPage.css";

export function SirisoLandingPage() {
  useSuppressQuickNavRail(true);

  const { isPro, isLoggedIn, proState, adsConfig, openProModal, enterWorkspace } =
    useSirisoPro();
  const { handleToolSelect, setReaderMode } = useToolWorkflow();
  const { actions: fileActions } = useFileActions();
  const navigate = useNavigate();
  const location = useLocation();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<FeatureCategoryId>("all");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const filteredFeatures = useMemo(() => {
    if (activeCategory === "all") return SIRISO_FEATURES;
    return SIRISO_FEATURES.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const handleOpenWorkspace = () => {
    enterWorkspace(() => {
      if (location.pathname === "/welcome") {
        navigate("/");
      }
    });
  };

  const handleOpenReader = () => {
    enterWorkspace(() => {
      setReaderMode(true);
    });
  };

  const handleLaunchTool = (toolId: ToolId) => {
    enterWorkspace(() => {
      handleToolSelect(toolId);
    });
  };

  const handlePickFilesClick = () => {
    if (!isLoggedIn) {
      enterWorkspace(() => {
        fileInputRef.current?.click();
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    enterWorkspace(() => {
      setIsUploading(true);
      void fileActions
        .addFiles(files)
        .then(() => {
          if (location.pathname === "/welcome") {
            navigate("/");
          }
        })
        .finally(() => {
          setIsUploading(false);
        });
    });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFilesSelected(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesSelected(e.dataTransfer.files);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const root = containerRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`#${sectionId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="siriso-lp"
      data-testid="siriso-landing-page"
    >
      <div className="siriso-lp-grid-backdrop" aria-hidden="true" />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={handleInputChange}
        aria-label="Unggah berkas PDF atau dokumen"
      />

      <header className="siriso-lp-header">
        <nav className="siriso-lp-nav" aria-label="Navigasi Utama Siriso PDF">
          <button
            type="button"
            className="siriso-lp-brand"
            onClick={scrollToTop}
            aria-label="Siriso PDF Beranda"
          >
            <span className="siriso-lp-brand-logo-wrap">
              <img
                src={sirisoLogoUrl}
                alt=""
                className="siriso-lp-brand-logo"
              />
            </span>
            <span className="siriso-lp-brand-text">
              <span className="siriso-lp-brand-name">SIRISO PDF</span>
              <span className="siriso-lp-brand-badge">SUITE 3.2</span>
            </span>
          </button>

          <div className="siriso-lp-nav-links">
            <button
              type="button"
              className="siriso-lp-nav-link"
              onClick={() => scrollToSection("fitur-utama")}
            >
              Fitur PDF
            </button>
            <button
              type="button"
              className="siriso-lp-nav-link"
              onClick={() => scrollToSection("arsitektur")}
            >
              Keunggulan Engine
            </button>
            <button
              type="button"
              className="siriso-lp-nav-link"
              onClick={() => scrollToSection("alur-kerja")}
            >
              Cara Kerja
            </button>
            <button
              type="button"
              className="siriso-lp-nav-link"
              onClick={() => scrollToSection("paket-pro")}
            >
              Paket Pro &amp; Desktop
            </button>
            <button
              type="button"
              className="siriso-lp-nav-link"
              onClick={() => scrollToSection("faq")}
            >
              FAQ
            </button>
          </div>

          <div className="siriso-lp-nav-actions">
            <a
              href="https://sirisolab.com"
              target="_blank"
              rel="noopener noreferrer"
              className="siriso-lp-lab-link"
            >
              <span>SIRISOLAB.COM</span>
              <Icon name="move-up-right" size="0.8rem" />
            </a>

            <button
              type="button"
              className="siriso-lp-btn siriso-lp-btn-outline-orange"
              onClick={openProModal}
              data-testid="landing-open-pro-modal"
            >
              <Icon
                name={isPro ? "badge-check" : isLoggedIn ? "user" : "log-in"}
                size="0.95rem"
              />
              <span>
                {isPro
                  ? "Akun Pro Aktif"
                  : isLoggedIn
                    ? proState.customerName || "Akun Saya"
                    : "Masuk / Paket Pro"}
              </span>
            </button>

            <button
              type="button"
              className="siriso-lp-btn siriso-lp-btn-primary"
              onClick={handleOpenWorkspace}
              data-testid="landing-open-workspace-header"
            >
              <span>Buka Workspace</span>
              <Icon name="arrow-right" size="0.95rem" />
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="siriso-lp-hero">
          <div className="siriso-lp-container">
            <div className="siriso-lp-hero-grid">
              <div>
                <div className="siriso-lp-telemetry-pill">
                  <span className="siriso-lp-pulse-dot" aria-hidden="true" />
                  <span>SIRISO LAB PRODUCT SUITE // PLATFORM DOKUMEN PDF</span>
                </div>

                <h1 className="siriso-lp-hero-title">
                  Kendali Penuh Dokumen PDF Anda dalam{" "}
                  <span className="siriso-lp-hero-title-accent">
                    Satu Workspace Profesional.
                  </span>
                </h1>

                <p className="siriso-lp-hero-desc">
                  Dirancang oleh <strong>Siriso Lab</strong> untuk produktivitas
                  tanpa hambatan. Gabungkan, pisahkan, kompres, edit teks
                  langsung di halaman, konversi dokumen Office dengan{" "}
                  <strong>Siriso Office Convert</strong>, tandatangani dengan
                  sertifikat digital, hingga jalankan OCR multi-bahasa secara
                  instan dan aman.
                </p>

                <div className="siriso-lp-hero-actions">
                  <button
                    type="button"
                    className="siriso-lp-btn siriso-lp-btn-primary siriso-lp-btn-lg"
                    onClick={handleOpenWorkspace}
                    data-testid="landing-open-workspace-hero"
                  >
                    <Icon name="layout-grid" size="1.1rem" />
                    <span>Buka Workspace PDF Sekarang</span>
                    <Icon name="arrow-right" size="1.05rem" />
                  </button>

                  <button
                    type="button"
                    className="siriso-lp-btn siriso-lp-btn-secondary siriso-lp-btn-lg"
                    onClick={handlePickFilesClick}
                  >
                    <Icon name="file-up" size="1.1rem" />
                    <span>
                      {isUploading ? "Memuat Berkas..." : "Pilih File PDF"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="siriso-lp-btn siriso-lp-btn-secondary siriso-lp-btn-lg"
                    onClick={handleOpenReader}
                  >
                    <Icon name="book-open" size="1.1rem" />
                    <span>Mode Baca PDF</span>
                  </button>
                </div>

                <div className="siriso-lp-trust-strip">
                  <div className="siriso-lp-trust-item">
                    <span className="siriso-lp-trust-value">50+ Alat PDF</span>
                    <span className="siriso-lp-trust-label">
                      Terintegrasi dalam satu kanvas tanpa perlu unggah ulang
                    </span>
                  </div>
                  <div className="siriso-lp-trust-item">
                    <span className="siriso-lp-trust-value">
                      Office &amp; OCR
                    </span>
                    <span className="siriso-lp-trust-label">
                      Konversi Word, Excel, PPT, Gambar &amp; pengenalan teks scan
                    </span>
                  </div>
                  <div className="siriso-lp-trust-item">
                    <span className="siriso-lp-trust-value">
                      Web &amp; Desktop
                    </span>
                    <span className="siriso-lp-trust-label">
                      Akses instan di browser atau unduh aplikasi Windows x64
                    </span>
                  </div>
                </div>
              </div>

              <div className="siriso-lp-launchpad">
                <div className="siriso-lp-launchpad-top">
                  <div className="siriso-lp-window-dots" aria-hidden="true">
                    <span className="siriso-lp-window-dot siriso-lp-window-dot--orange" />
                    <span className="siriso-lp-window-dot" />
                    <span className="siriso-lp-window-dot" />
                  </div>
                  <span className="siriso-lp-launchpad-tag">
                    PELUNCUR CEPAT // SIRISO PDF ENGINE
                  </span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  className={`siriso-lp-dropzone ${
                    isDraggingOver ? "siriso-lp-dropzone--active" : ""
                  }`}
                  onClick={handlePickFilesClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handlePickFilesClick();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleDrop}
                  aria-label="Jatuhkan berkas PDF di sini atau klik untuk memilih berkas dari komputer"
                >
                  <div className="siriso-lp-dropzone-icon">
                    <Icon name="upload" size="1.5rem" />
                  </div>
                  <div className="siriso-lp-dropzone-title">
                    {isUploading
                      ? "Memproses Berkas ke Workspace..."
                      : "Tarik & Jatuhkan File PDF di Sini"}
                  </div>
                  <div className="siriso-lp-dropzone-sub">
                    Langsung membuka editor Siriso PDF dengan dokumen Anda siap
                    diolah
                  </div>
                  <span className="siriso-lp-btn siriso-lp-btn-outline-orange">
                    <Icon name="folder-open" size="0.95rem" />
                    <span>Jelajahi Berkas Komputer</span>
                  </span>
                </div>

                <div className="siriso-lp-quick-heading">
                  <span>PINTASAN ALAT POPULER</span>
                  <span>KLIK UNTUK LANGSUNG BUKA</span>
                </div>

                <div className="siriso-lp-quick-grid">
                  {QUICK_LAUNCH_TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      className="siriso-lp-quick-btn"
                      onClick={() => handleLaunchTool(tool.toolId)}
                    >
                      <span className="siriso-lp-quick-icon">
                        <Icon name={tool.icon} size="1.05rem" />
                      </span>
                      <span className="siriso-lp-quick-copy">
                        <span className="siriso-lp-quick-label">
                          {tool.label}
                        </span>
                        <span className="siriso-lp-quick-sub">
                          {tool.sublabel}
                        </span>
                      </span>
                      <Icon name="chevron-right" size="0.9rem" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="siriso-lp-marquee" aria-label="Ringkasan kapabilitas">
          <div className="siriso-lp-marquee-row">
            <span>GABUNG &amp; PISAH PDF</span>
            <span className="siriso-lp-marquee-dot">•</span>
            <span>SIRISO OFFICE CONVERT</span>
            <span className="siriso-lp-marquee-dot">•</span>
            <span>EDITOR TEKS KANVAS</span>
            <span className="siriso-lp-marquee-dot">•</span>
            <span>KOMPRESI PRESISI</span>
            <span className="siriso-lp-marquee-dot">•</span>
            <span>TANDA TANGAN SERTIFIKAT X.509</span>
            <span className="siriso-lp-marquee-dot">•</span>
            <span>OCR DOKUMEN SCAN</span>
            <span className="siriso-lp-marquee-dot">•</span>
            <span>REDAKSI &amp; ENKRIPSI AES-256</span>
          </div>
        </div>

        <section className="siriso-lp-section" id="fitur-utama">
          <div className="siriso-lp-container">
            <div className="siriso-lp-section-header">
              <div>
                <div className="siriso-lp-section-label">
                  <span className="siriso-lp-section-index">(01)</span>
                  <span>KAPABILITAS LENGKAP SIRISO PDF</span>
                </div>
                <h2 className="siriso-lp-section-title">
                  Penjelasan Fitur &amp; Modul Alat PDF
                </h2>
              </div>
              <p className="siriso-lp-section-subtitle">
                Setiap fitur dirancang untuk menyelesaikan pekerjaan dokumen
                teknis, administrasi bisnis, hingga akademik secara akurat.
                Pilih kategori di bawah atau klik langsung pada fitur untuk
                membukanya.
              </p>
            </div>

            <div
              className="siriso-lp-filter-bar"
              role="tablist"
              aria-label="Filter kategori fitur Siriso PDF"
            >
              {FEATURE_CATEGORIES.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`siriso-lp-filter-tab ${
                      active ? "siriso-lp-filter-tab--active" : ""
                    }`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span>{cat.label}</span>
                    <span className="siriso-lp-filter-count">{cat.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="siriso-lp-features-grid">
              {filteredFeatures.map((feat) => (
                <article key={feat.id} className="siriso-lp-feature-card">
                  <div>
                    <div className="siriso-lp-feature-top">
                      <div className="siriso-lp-feature-icon-box">
                        <Icon name={feat.icon} size="1.35rem" />
                      </div>
                      <div className="siriso-lp-feature-meta">
                        {feat.badge && (
                          <span className="siriso-lp-feature-badge">
                            {feat.badge}
                          </span>
                        )}
                        <span className="siriso-lp-feature-code">
                          {feat.code}
                        </span>
                      </div>
                    </div>

                    <div className="siriso-lp-feature-category">
                      {feat.categoryLabel}
                    </div>
                    <h3 className="siriso-lp-feature-title">{feat.title}</h3>
                    <div className="siriso-lp-feature-sub">{feat.subtitle}</div>
                    <p className="siriso-lp-feature-desc">{feat.description}</p>

                    <ul className="siriso-lp-feature-list">
                      {feat.highlights.map((pt) => (
                        <li key={pt} className="siriso-lp-feature-list-item">
                          <Icon name="circle-check" size="0.9rem" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    className="siriso-lp-feature-cta"
                    onClick={() => handleLaunchTool(feat.toolId)}
                  >
                    <span>Gunakan Fitur Ini</span>
                    <Icon name="arrow-right" size="0.95rem" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="siriso-lp-section" id="arsitektur">
          <div className="siriso-lp-container">
            <div className="siriso-lp-section-header">
              <div>
                <div className="siriso-lp-section-label">
                  <span className="siriso-lp-section-index">(02)</span>
                  <span>ARSITEKTUR &amp; STANDAR KUALITAS SIRISO LAB</span>
                </div>
                <h2 className="siriso-lp-section-title">
                  Mengapa Profesional Memilih Siriso PDF?
                </h2>
              </div>
              <p className="siriso-lp-section-subtitle">
                Dibangun dengan fondasi rekayasa perangkat lunak modern yang
                mengutamakan kecepatan pemrosesan, keutuhan tata letak dokumen,
                dan perlindungan privasi.
              </p>
            </div>

            <div className="siriso-lp-arch-grid">
              {ARCHITECTURE_PODS.map((pod) => (
                <div key={pod.index} className="siriso-lp-arch-pod">
                  <div>
                    <div className="siriso-lp-arch-head">
                      <span className="siriso-lp-arch-idx">{pod.index}</span>
                      <Icon name={pod.icon} size="1.2rem" />
                    </div>
                    <div className="siriso-lp-arch-metric">{pod.metric}</div>
                    <h3 className="siriso-lp-arch-title">{pod.title}</h3>
                    <p className="siriso-lp-arch-desc">{pod.description}</p>
                  </div>
                  <div className="siriso-lp-arch-specs">
                    {pod.specs.map((spec) => (
                      <span key={spec} className="siriso-lp-spec-chip">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="siriso-lp-section" id="alur-kerja">
          <div className="siriso-lp-container">
            <div className="siriso-lp-section-header">
              <div>
                <div className="siriso-lp-section-label">
                  <span className="siriso-lp-section-index">(03)</span>
                  <span>ALUR KERJA RAMAH PENGGUNA</span>
                </div>
                <h2 className="siriso-lp-section-title">
                  Selesaikan Dokumen dalam 3 Langkah
                </h2>
              </div>
              <p className="siriso-lp-section-subtitle">
                Antarmuka bersih tanpa kurva belajar yang rumit. Semua alat
                tersedia dalam satu meja kerja terpadu.
              </p>
            </div>

            <div className="siriso-lp-steps-grid">
              {WORKFLOW_STEPS.map((ws) => (
                <div key={ws.step} className="siriso-lp-step-card">
                  <div className="siriso-lp-step-top">
                    <span className="siriso-lp-step-num">{ws.step}</span>
                    <span className="siriso-lp-step-phase">{ws.phase}</span>
                  </div>
                  <h3 className="siriso-lp-step-title">{ws.title}</h3>
                  <p className="siriso-lp-step-desc">{ws.description}</p>
                  <div className="siriso-lp-step-badge">
                    <Icon name={ws.icon} size="0.95rem" />
                    <span>{ws.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="siriso-lp-section" id="paket-pro">
          <div className="siriso-lp-container">
            <div className="siriso-lp-section-header">
              <div>
                <div className="siriso-lp-section-label">
                  <span className="siriso-lp-section-index">(04)</span>
                  <span>EDISI WEB GRATIS &amp; PAKET PRO DESKTOP</span>
                </div>
                <h2 className="siriso-lp-section-title">
                  Pilih Pengalaman Kerja Sesuai Kebutuhan Anda
                </h2>
              </div>
              <p className="siriso-lp-section-subtitle">
                Gunakan langsung di web secara gratis, atau tingkatkan ke Paket
                Pro untuk pengalaman bebas iklan dan aplikasi Desktop Windows
                offline.
              </p>
            </div>

            <div className="siriso-lp-pricing-grid">
              <div className="siriso-lp-plan-card">
                <div>
                  <span className="siriso-lp-brand-badge">AKSES WEB STANDAR</span>
                  <div className="siriso-lp-plan-price">
                    Gratis{" "}
                    <span className="siriso-lp-plan-period">
                      / Selamanya di Browser
                    </span>
                  </div>
                  <p className="siriso-lp-feature-desc">
                    Cocok untuk kebutuhan pengolahan dokumen PDF harian langsung
                    dari peramban tanpa instalasi.
                  </p>
                  <ul className="siriso-lp-plan-list">
                    <li className="siriso-lp-plan-item">
                      <Icon name="check" size="1rem" />
                      <span>
                        Akses ke alat-alat PDF utama (Gabung, Pisah, Kompres,
                        Putar, Baca &amp; Anotasi)
                      </span>
                    </li>
                    <li className="siriso-lp-plan-item">
                      <Icon name="check" size="1rem" />
                      <span>
                        Alur kerja Multi-Tool berantai langsung di memori
                        peramban
                      </span>
                    </li>
                    <li className="siriso-lp-plan-item">
                      <Icon name="check" size="1rem" />
                      <span>
                        Cukup daftar akun gratis Siriso PDF untuk membuka akses
                        penuh ke Workspace Web
                      </span>
                    </li>
                    <li className="siriso-lp-plan-item">
                      <Icon name="info" size="1rem" />
                      <span>
                        Hanya menampilkan iklan resmi Google AdSense (tanpa
                        banner placeholder pihak ketiga)
                      </span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  className="siriso-lp-btn siriso-lp-btn-secondary siriso-lp-btn-lg"
                  onClick={handleOpenWorkspace}
                >
                  <span>Mulai Gunakan Versi Web Gratis</span>
                  <Icon name="arrow-right" size="1rem" />
                </button>
              </div>

              <div className="siriso-lp-plan-card siriso-lp-plan-card--pro">
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span className="siriso-lp-brand-badge">
                      SIRISO PDF PAKET PRO
                    </span>
                    <span className="siriso-lp-feature-code">
                      BEBAS IKLAN + DESKTOP WINDOWS
                    </span>
                  </div>
                  <div className="siriso-lp-plan-price">
                    {adsConfig.priceFormatted || "Rp 25.000 / bulan"}
                  </div>
                  <p className="siriso-lp-feature-desc">
                    Solusi profesional tanpa gangguan iklan di web sekaligus
                    akses unduhan installer aplikasi Siriso PDF Desktop Windows
                    (x64).
                  </p>
                  <ul className="siriso-lp-plan-list">
                    <li className="siriso-lp-plan-item">
                      <Icon name="badge-check" size="1.05rem" />
                      <span>
                        <strong>100% Bebas Iklan</strong> di seluruh antarmuka
                        web dan meja kerja PDF
                      </span>
                    </li>
                    <li className="siriso-lp-plan-item">
                      <Icon name="download" size="1.05rem" />
                      <span>
                        <strong>
                          Unduh Siriso PDF Desktop (Windows x64)
                        </strong>{" "}
                        untuk pemrosesan lokal &amp; offline tanpa batas
                      </span>
                    </li>
                    <li className="siriso-lp-plan-item">
                      <Icon name="sparkles" size="1.05rem" />
                      <span>
                        <strong>Kapabilitas Penuh</strong>: Siriso Office
                        Convert, OCR multi-bahasa, tanda tangan sertifikat &amp;
                        pipeline otomatisasi
                      </span>
                    </li>
                    <li className="siriso-lp-plan-item">
                      <Icon name="log-in" size="1.05rem" />
                      <span>
                        <strong>Login Akun Otomatis di Web</strong> + Kode
                        Aktivasi khusus untuk mode offline Aplikasi Desktop
                      </span>
                    </li>
                  </ul>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <button
                    type="button"
                    className="siriso-lp-btn siriso-lp-btn-primary siriso-lp-btn-lg"
                    style={{ flex: 1 }}
                    onClick={openProModal}
                  >
                    <Icon name={isPro ? "badge-check" : "log-in"} size="1.05rem" />
                    <span>
                      {isPro
                        ? "Akun Pro & Unduh Aplikasi Desktop"
                        : "Masuk Akun / Upgrade Paket Pro"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="siriso-lp-section" id="faq">
          <div className="siriso-lp-container">
            <div className="siriso-lp-section-header">
              <div>
                <div className="siriso-lp-section-label">
                  <span className="siriso-lp-section-index">(05)</span>
                  <span>PUSAT INFORMASI &amp; TANYA JAWAB</span>
                </div>
                <h2 className="siriso-lp-section-title">
                  Pertanyaan yang Sering Diajukan
                </h2>
              </div>
              <p className="siriso-lp-section-subtitle">
                Jawaban jelas mengenai fitur teknis Siriso PDF, keamanan
                dokumen, serta lisensi Paket Pro.
              </p>
            </div>

            <div className="siriso-lp-faq-list">
              {SIRISO_FAQS.map((faq, idx) => (
                <details
                  key={faq.num}
                  className="siriso-lp-faq-item"
                  open={idx === 0}
                >
                  <summary className="siriso-lp-faq-summary">
                    <span className="siriso-lp-faq-left">
                      <span className="siriso-lp-faq-num">{faq.num}</span>
                      <span>{faq.question}</span>
                    </span>
                    <Icon name="chevron-down" size="1.05rem" />
                  </summary>
                  <div className="siriso-lp-faq-answer">{faq.answer}</div>
                </details>
              ))}
            </div>

            <div className="siriso-lp-cta-banner" style={{ marginTop: "3rem" }}>
              <div>
                <div className="siriso-lp-section-label">
                  <span className="siriso-lp-section-index">SIAP MULAI?</span>
                  <span>WORKSPACE PDF PROFESIONAL</span>
                </div>
                <h3
                  className="siriso-lp-section-title"
                  style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)" }}
                >
                  Buka Workspace Siriso PDF &amp; Olah Dokumen Anda Sekarang
                </h3>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="siriso-lp-btn siriso-lp-btn-primary siriso-lp-btn-lg"
                  onClick={handleOpenWorkspace}
                >
                  <span>Masuk ke Workspace PDF</span>
                  <Icon name="arrow-right" size="1.05rem" />
                </button>
                <button
                  type="button"
                  className="siriso-lp-btn siriso-lp-btn-secondary siriso-lp-btn-lg"
                  onClick={openProModal}
                >
                  <Icon name="star" size="1rem" />
                  <span>Info Paket Pro</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="siriso-lp-footer">
        <div className="siriso-lp-container">
          <div className="siriso-lp-footer-top">
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  marginBottom: "0.75rem",
                }}
              >
                <span className="siriso-lp-brand-logo-wrap">
                  <img
                    src={sirisoLogoUrl}
                    alt=""
                    className="siriso-lp-brand-logo"
                  />
                </span>
                <span className="siriso-lp-brand-name">SIRISO PDF</span>
              </div>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--lp-text-muted)",
                  maxWidth: "320px",
                  margin: "0 0 1rem",
                }}
              >
                Platform pengolahan, konversi, dan keamanan dokumen PDF
                profesional dari ekosistem produk digital{" "}
                <strong>Siriso Lab</strong>.
              </p>
              <span className="siriso-lp-spec-chip">
                TLS 1.3 • AES-256 • SIRISO ENGINE
              </span>
            </div>

            <div>
              <h4 className="siriso-lp-footer-col-title">Alat Populer</h4>
              <ul className="siriso-lp-footer-links">
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("merge")}
                  >
                    Gabung PDF (Merge)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("split")}
                  >
                    Pisah Halaman (Split)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("compress")}
                  >
                    Kompres Ukuran PDF
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("convert")}
                  >
                    Siriso Office Convert
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="siriso-lp-footer-col-title">Edit &amp; Keamanan</h4>
              <ul className="siriso-lp-footer-links">
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("pdfTextEditor")}
                  >
                    Editor Teks PDF
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("sign")}
                  >
                    Tanda Tangan Digital
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("ocr")}
                  >
                    OCR Pengenalan Teks
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={() => handleLaunchTool("redact")}
                  >
                    Redaksi &amp; Proteksi PDF
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="siriso-lp-footer-col-title">Ekosistem Siriso</h4>
              <ul className="siriso-lp-footer-links">
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={handleOpenWorkspace}
                  >
                    Buka Semua Alat (Workspace)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={openProModal}
                  >
                    Aktivasi Lisensi Paket Pro
                  </button>
                </li>
                <li>
                  <a
                    href="https://sirisolab.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="siriso-lp-footer-link"
                  >
                    Website Utama — sirisolab.com ↗
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    className="siriso-lp-footer-link"
                    onClick={scrollToTop}
                  >
                    Kembali ke Atas ↑
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="siriso-lp-footer-bottom">
            <span>
              © {new Date().getFullYear()} Siriso PDF — Produk dari Siriso Lab
              (sirisolab.com). Seluruh Hak Cipta Dilindungi.
            </span>
            <span>HIGH-PRECISION DOCUMENT WORKSPACE // JAKARTA, ID</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

