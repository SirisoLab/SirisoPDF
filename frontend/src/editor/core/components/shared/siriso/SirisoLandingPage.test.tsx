import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SirisoLandingPage } from "@editor/components/shared/siriso/SirisoLandingPage";
import { SirisoProModal } from "@editor/components/shared/siriso/SirisoProModal";
import {
  DEFAULT_ACCESS_POLICY,
  DEFAULT_PRICING,
} from "@editor/services/sirisoProService";

const mocks = vi.hoisted(() => ({
  enterWorkspace: vi.fn((cb?: () => void) => cb?.()),
  openProModal: vi.fn(),
  closeProModal: vi.fn(),
  openLandingPage: vi.fn(),
  loginAccount: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  registerAccount: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  requestProUpgrade: vi
    .fn()
    .mockResolvedValue({ success: true, message: "OK" }),
  createQrisPayment: vi
    .fn()
    .mockResolvedValue({ success: true, message: "OK" }),
  logoutAccount: vi.fn(),
  activateLicense: vi.fn().mockResolvedValue({ success: true, message: "OK" }),
  refreshStatus: vi.fn().mockResolvedValue(undefined),
  handleToolSelect: vi.fn(),
  setReaderMode: vi.fn(),
  addFiles: vi.fn().mockResolvedValue(undefined),
}));

let mockContextState: Record<string, unknown> = {};

vi.mock("@editor/contexts/SirisoProContext", async () => {
  const service = await vi.importActual<
    typeof import("@editor/services/sirisoProService")
  >("@editor/services/sirisoProService");
  return {
    useSirisoPro: () => ({
      isPro: false,
      isLoggedIn: false,
      role: "user",
      isAdmin: false,
      canUseWorkspace: false,
      isAdFree: false,
      proState: { isPro: false },
      adsConfig: service.DEFAULT_ADS_CONFIG,
      pricing: service.DEFAULT_PRICING,
      accessPolicy: service.DEFAULT_ACCESS_POLICY,
      activeQrisOrder: undefined,
      isProModalOpen: true,
      pendingWorkspaceEntry: true,
      openProModal: mocks.openProModal,
      closeProModal: mocks.closeProModal,
      openLandingPage: mocks.openLandingPage,
      loginAccount: mocks.loginAccount,
      registerAccount: mocks.registerAccount,
      requestProUpgrade: mocks.requestProUpgrade,
      createQrisPayment: mocks.createQrisPayment,
      logoutAccount: mocks.logoutAccount,
      activateLicense: mocks.activateLicense,
      refreshStatus: mocks.refreshStatus,
      isChecking: false,
      enterWorkspace: mocks.enterWorkspace,
      ...mockContextState,
    }),
  };
});

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

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <SirisoLandingPage />
    </MemoryRouter>,
  );
}

describe("SirisoLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextState = {};
  });

  it("renders hero, feature explanations, and sirisolab.com branding", () => {
    renderLanding();

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
    renderLanding();

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
    renderLanding();

    fireEvent.click(screen.getByTestId("landing-open-workspace-hero"));
    expect(mocks.enterWorkspace).toHaveBeenCalledTimes(1);
  });

  it("shows the Pro price, promo and features configured in the backoffice", () => {
    mockContextState = {
      pricing: {
        ...DEFAULT_PRICING,
        name: "Paket Pro",
        price: 19000,
        compareAtPrice: 29000,
        formattedPrice: "Rp 19.000 / bulan",
        formattedCompareAt: "Rp 29.000 / bulan",
        promoLabel: "Hemat 34%",
        features: ["Bebas iklan", "Aplikasi desktop"],
      },
    };
    renderLanding();

    const pro = screen.getByTestId("landing-pro-plan");
    expect(screen.getByTestId("landing-pro-price")).toHaveTextContent(
      "Rp 19.000 / bulan",
    );
    expect(screen.getByTestId("landing-pro-compare")).toHaveTextContent(
      "Rp 29.000 / bulan",
    );
    expect(within(pro).getByText("Hemat 34%")).toBeInTheDocument();
    expect(within(pro).getByText("Aplikasi desktop")).toBeInTheDocument();
    // FAQ follows the same price instead of a hard-coded one
    expect(
      screen.getByText(/Paket Pro \(Rp 19\.000 \/ bulan\)\?/),
    ).toBeInTheDocument();
  });

  it("hides the free plan while the workspace requires Pro, and shows it in free mode", () => {
    const { unmount } = renderLanding();
    expect(screen.queryByTestId("landing-free-plan")).not.toBeInTheDocument();
    unmount();

    mockContextState = {
      accessPolicy: { ...DEFAULT_ACCESS_POLICY, workspaceRequiresPro: false },
    };
    renderLanding();
    expect(screen.getByTestId("landing-free-plan")).toHaveTextContent(
      DEFAULT_PRICING.free.name,
    );
  });

  it("gives a signed-in visitor an account menu that signs out", () => {
    mockContextState = {
      isLoggedIn: true,
      proState: {
        isPro: false,
        customerName: "Hanz PM",
        customerEmail: "hanz@example.com",
      },
    };
    renderLanding();

    expect(
      screen.queryByTestId("landing-open-pro-modal"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("landing-account-button"));
    const menu = screen.getByTestId("siriso-account-menu");
    expect(within(menu).getByText("hanz@example.com")).toBeInTheDocument();
    fireEvent.click(within(menu).getByTestId("siriso-account-logout"));
    expect(mocks.logoutAccount).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("siriso-account-menu")).not.toBeInTheDocument();
  });

  it("renders SirisoProModal with account login/register and no Backoffice link", () => {
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

  it("lets a free account into the workspace when the backoffice allows free access", () => {
    mockContextState = {
      isLoggedIn: true,
      canUseWorkspace: true,
      accessPolicy: { ...DEFAULT_ACCESS_POLICY, workspaceRequiresPro: false },
      proState: { isPro: false, customerEmail: "free@example.com" },
    };

    render(<SirisoProModal />);

    expect(
      screen.queryByTestId("siriso-workspace-locked-banner"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("siriso-modal-enter-workspace-btn"),
    ).toBeInTheDocument();
  });

  it("unlocks workspace entry, desktop download and renewal when user is active Pro", () => {
    mockContextState = {
      isLoggedIn: true,
      isPro: true,
      isAdFree: true,
      canUseWorkspace: true,
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
    expect(screen.getByTestId("siriso-renew-btn")).toBeInTheDocument();
    expect(
      screen.queryByTestId("siriso-workspace-locked-banner"),
    ).not.toBeInTheDocument();
  });

  it("treats a Tim/Admin role as full access without a subscription", () => {
    mockContextState = {
      isLoggedIn: true,
      isPro: false,
      isAdFree: true,
      canUseWorkspace: true,
      role: "staff",
      proState: {
        isPro: false,
        role: "staff",
        customerName: "Tim Siriso",
        customerEmail: "tim@sirisolab.com",
        desktopActivationCode: "SRP-DESK-TEAM",
      },
    };

    render(<SirisoProModal />);

    expect(screen.getByTestId("siriso-account-status")).toHaveTextContent(
      /Akses Penuh · Tim Siriso/,
    );
    expect(
      screen.getByTestId("siriso-download-desktop-btn"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("siriso-renew-btn")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("siriso-qris-gateway-card"),
    ).not.toBeInTheDocument();
  });
});
