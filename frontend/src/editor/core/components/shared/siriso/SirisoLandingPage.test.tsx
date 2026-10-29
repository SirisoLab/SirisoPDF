import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SirisoLandingPage } from "@editor/components/shared/siriso/SirisoLandingPage";
import { SirisoProModal } from "@editor/components/shared/siriso/SirisoProModal";

const mocks = vi.hoisted(() => ({
  enterWorkspace: vi.fn((cb?: () => void) => cb?.()),
  openProModal: vi.fn(),
  closeProModal: vi.fn(),
  loginAccount: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  registerAccount: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  requestProUpgrade: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  logoutAccount: vi.fn(),
  activateLicense: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  refreshStatus: vi.fn().mockResolvedValue(undefined),
  handleToolSelect: vi.fn(),
  setReaderMode: vi.fn(),
  addFiles: vi.fn().mockResolvedValue(undefined),
}));

let mockContextState: Record<string, any> = {};

vi.mock("@editor/contexts/SirisoProContext", () => ({
  useSirisoPro: () => ({
    isPro: false,
    isLoggedIn: false,
    proState: { isPro: false },
    adsConfig: { priceFormatted: "Rp 25.000 / bulan" },
    activeQrisOrder: undefined,
    isProModalOpen: true,
    pendingWorkspaceEntry: true,
    openProModal: mocks.openProModal,
    closeProModal: mocks.closeProModal,
    loginAccount: mocks.loginAccount,
    registerAccount: mocks.registerAccount,
    requestProUpgrade: mocks.requestProUpgrade,
    logoutAccount: mocks.logoutAccount,
    activateLicense: mocks.activateLicense,
    refreshStatus: mocks.refreshStatus,
    isChecking: false,
    enterWorkspace: mocks.enterWorkspace,
    ...mockContextState,
  }),
}));

vi.mock("@editor/contexts/QuickNavHostContext", () => ({
  useSuppressQuickNavRail: vi.fn(),
}));

vi.mock("@editor/contexts/ToolWorkflowContext", () => ({
  useToolWorkflow: () => ({
    handleToolSelect: mocks.handleToolSelect,
    setReaderMode: mocks.setReaderMode,
  }),
}));

vi.mock("@editor/contexts/file/fileHooks", () => ({
  useFileActions: () => ({
    actions: {
      addFiles: mocks.addFiles,
    },
  }),
}));

describe("SirisoLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders hero, feature explanations, and sirisolab.com branding", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SirisoLandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("siriso-landing-page")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Kendali Penuh Dokumen PDF Anda/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Gabung & Pisah PDF Presisi Tinggi/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Siriso Office Convert & Multi-Format/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tanda Tangan Digital & Sertifikat X\.509/i),
    ).toBeInTheDocument();
  });

  it("filters features by category and launches selected tool into workspace", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SirisoLandingPage />
      </MemoryRouter>,
    );

    const securityTab = screen.getByRole("tab", {
      name: /Keamanan & Tanda Tangan/i,
    });
    fireEvent.click(securityTab);

    expect(
      screen.getByText(/Tanda Tangan Digital & Sertifikat X\.509/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Gabung & Pisah PDF Presisi Tinggi/i),
    ).not.toBeInTheDocument();

    const useButtons = screen.getAllByRole("button", {
      name: /Gunakan Fitur Ini/i,
    });
    fireEvent.click(useButtons[0]);

    expect(mocks.enterWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.handleToolSelect).toHaveBeenCalledWith("sign");
  });

  it("enters workspace when primary CTA is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SirisoLandingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("landing-open-workspace-hero"));
    expect(mocks.enterWorkspace).toHaveBeenCalledTimes(1);
  });

  it("renders SirisoProModal with account login/register and no Backoffice link", () => {
    mockContextState = { isLoggedIn: false, isPro: false };
    render(<SirisoProModal />);

    expect(screen.getByTestId("siriso-pro-modal")).toBeInTheDocument();
    expect(screen.getByTestId("siriso-tab-login")).toBeInTheDocument();
    expect(screen.getByTestId("siriso-tab-register")).toBeInTheDocument();
    expect(screen.queryByText(/Backoffice/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("siriso-tab-register"));
    expect(screen.getByTestId("siriso-input-name")).toBeInTheDocument();
  });

  it("locks workspace for free tier and requires immediate QRIS payment without workspace enter button", () => {
    mockContextState = {
      isLoggedIn: true,
      isPro: false,
      proState: {
        isPro: false,
        customerName: "Hanz PM",
        customerEmail: "hanzputra06@gmail.com",
      },
      activeQrisOrder: {
        orderId: "QRIS-TEST-123",
        merchantName: "SIRISO LAB",
        nmid: "ID2026SIRISOLAB001",
        qrisImageUrl: "https://example.com/qris.png",
        formattedTotal: "Rp 25.432",
        totalAmount: 25432,
        status: "pending",
        supportedApps: "BCA, Mandiri, BRI, GoPay, DANA",
      },
    };

    render(<SirisoProModal />);

    expect(
      screen.getByTestId("siriso-workspace-locked-banner"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("siriso-modal-enter-workspace-btn"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("siriso-qris-gateway-card")).toBeInTheDocument();
    expect(screen.getByTestId("siriso-qris-amount")).toHaveTextContent(
      "Rp 25.432",
    );
    expect(screen.getByTestId("siriso-confirm-qris-btn")).toBeInTheDocument();
    expect(screen.getByTestId("siriso-refresh-status-btn")).toBeInTheDocument();
  });

  it("unlocks workspace entry and desktop download button when user is active Pro", () => {
    mockContextState = {
      isLoggedIn: true,
      isPro: true,
      proState: {
        isPro: true,
        proStatus: "active",
        customerName: "Hanz Pro",
        customerEmail: "pro@sirisolab.com",
        desktopActivationCode: "SRP-DESK-9999",
      },
    };

    render(<SirisoProModal />);

    expect(
      screen.getByTestId("siriso-modal-enter-workspace-btn"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("siriso-download-desktop-btn"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("siriso-workspace-locked-banner"),
    ).not.toBeInTheDocument();
  });
});

