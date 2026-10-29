import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearStoredProState,
  confirmSirisoQrisPayment,
  createSirisoQrisPayment,
  DEFAULT_ADS_CONFIG,
  fetchSirisoAccountMe,
  fetchSirisoAdsConfig,
  fetchSirisoQrisPaymentStatus,
  getStoredProState,
  loginSirisoAccount,
  mapUserToProState,
  registerSirisoAccount,
  requestSirisoProUpgrade,
  saveStoredProState,
  SirisoAdsConfig,
  SirisoProState,
  SirisoQrisOrder,
  verifySirisoLicense,
} from "@editor/services/sirisoProService";

export interface SirisoProContextType {
  isPro: boolean;
  isLoggedIn: boolean;
  proState: SirisoProState;
  adsConfig: SirisoAdsConfig;
  activeQrisOrder: SirisoQrisOrder | null;
  isProModalOpen: boolean;
  setIsProModalOpen: (open: boolean) => void;
  openProModal: () => void;
  closeProModal: () => void;
  isLandingOpen: boolean;
  pendingWorkspaceEntry: boolean;
  openLandingPage: () => void;
  enterWorkspace: (onEntered?: () => void) => void;
  loginAccount: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  registerAccount: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  requestProUpgrade: () => Promise<{ success: boolean; message: string }>;
  createQrisPayment: (forceNew?: boolean) => Promise<{
    success: boolean;
    message: string;
    order?: SirisoQrisOrder;
  }>;
  confirmQrisPayment: (
    orderId: string,
    payerNote?: string,
  ) => Promise<{
    success: boolean;
    message: string;
    order?: SirisoQrisOrder;
  }>;
  checkQrisPaymentStatus: (orderId?: string) => Promise<void>;
  logoutAccount: () => void;
  activateLicense: (
    key: string,
  ) => Promise<{ success: boolean; message: string }>;
  deactivateLicense: () => void;
  refreshStatus: () => Promise<void>;
  isChecking: boolean;
}

const SirisoProContext = createContext<SirisoProContextType | null>(null);

function hasAuthenticatedAccount(state: SirisoProState): boolean {
  return Boolean(state.authToken || state.customerEmail || state.isPro);
}

function getInitialLandingState(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.MODE === "test") return false;
  const stored = getStoredProState();
  const isUserPro = Boolean(stored.isPro && stored.proStatus === "active");
  if (!isUserPro) {
    return true;
  }
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(window.location.search);
  if (params.has("tool") || params.get("workspace") === "1") {
    return false;
  }
  return path === "/" || path === "/welcome";
}

export function SirisoProProvider({ children }: { children: ReactNode }) {
  const [proState, setProState] = useState<SirisoProState>(getStoredProState);
  const [adsConfig, setAdsConfig] =
    useState<SirisoAdsConfig>(DEFAULT_ADS_CONFIG);
  const [activeQrisOrder, setActiveQrisOrder] =
    useState<SirisoQrisOrder | null>(null);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isLandingOpen, setIsLandingOpen] = useState<boolean>(
    getInitialLandingState,
  );
  const [pendingWorkspaceEntry, setPendingWorkspaceEntry] = useState(false);
  const pendingWorkspaceCallbackRef = useRef<(() => void) | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const isLoggedIn = hasAuthenticatedAccount(proState);
  const isPro = Boolean(proState.isPro);

  const openProModal = useCallback(() => {
    setPendingWorkspaceEntry(false);
    pendingWorkspaceCallbackRef.current = null;
    setIsProModalOpen(true);
  }, []);

  const closeProModal = useCallback(() => {
    setIsProModalOpen(false);
    setPendingWorkspaceEntry(false);
    pendingWorkspaceCallbackRef.current = null;
  }, []);

  const openLandingPage = useCallback(() => setIsLandingOpen(true), []);

  const completePendingWorkspaceEntry = useCallback(() => {
    setIsLandingOpen(false);
    setPendingWorkspaceEntry(false);
    setIsProModalOpen(false);
    const cb = pendingWorkspaceCallbackRef.current;
    pendingWorkspaceCallbackRef.current = null;
    if (cb) {
      cb();
    }
  }, []);

  const enterWorkspace = useCallback(
    (onEntered?: () => void) => {
      if (isLoggedIn && isPro) {
        setIsLandingOpen(false);
        setPendingWorkspaceEntry(false);
        setIsProModalOpen(false);
        onEntered?.();
        return;
      }
      pendingWorkspaceCallbackRef.current = onEntered ?? null;
      setPendingWorkspaceEntry(true);
      setIsProModalOpen(true);
      if (isLoggedIn && !isPro && !activeQrisOrder) {
        const token = proState.authToken || getStoredProState().authToken;
        if (token) {
          void createSirisoQrisPayment(token).then((res) => {
            if (res.success && res.order) {
              setActiveQrisOrder(res.order);
            }
          });
        }
      }
    },
    [isLoggedIn, isPro, activeQrisOrder, proState.authToken],
  );

  const refreshStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const config = await fetchSirisoAdsConfig();
      setAdsConfig(config);

      const stored = getStoredProState();
      if (stored.authToken) {
        const me = await fetchSirisoAccountMe(stored.authToken);
        if (me.success && me.user) {
          const updated = mapUserToProState(me.user, stored.authToken);
          setProState(updated);
          saveStoredProState(updated);
          return;
        }
      }

      if (stored.licenseKey) {
        const res = await verifySirisoLicense(stored.licenseKey);
        if (res.success && res.subscription) {
          const updated: SirisoProState = {
            isPro: true,
            proStatus: "active",
            licenseKey: res.subscription.licenseKey,
            desktopActivationCode: res.subscription.licenseKey,
            customerName: res.subscription.customerName,
            customerEmail: res.subscription.customerEmail,
            expiresAt: res.subscription.expiresAt,
            downloadsCount: res.subscription.downloadsCount,
          };
          setProState(updated);
          saveStoredProState(updated);
        } else if (!stored.authToken) {
          const expired: SirisoProState = { isPro: false };
          setProState(expired);
          clearStoredProState();
        }
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  const loginAccount = useCallback(
    async (email: string, password: string) => {
      setIsChecking(true);
      try {
        const res = await loginSirisoAccount(email, password);
        if (res.success && res.user) {
          const nextState = mapUserToProState(res.user, res.token);
          setProState(nextState);
          saveStoredProState(nextState);
          if (nextState.isPro) {
            if (pendingWorkspaceEntry) {
              completePendingWorkspaceEntry();
            }
          } else {
            // Free tier cannot enter workspace - must pay directly via QRIS
            setPendingWorkspaceEntry(true);
            setIsProModalOpen(true);
            if (res.token) {
              void createSirisoQrisPayment(res.token).then((qrisRes) => {
                if (qrisRes.success && qrisRes.order) {
                  setActiveQrisOrder(qrisRes.order);
                }
              });
            }
          }
          return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [pendingWorkspaceEntry, completePendingWorkspaceEntry],
  );

  const registerAccount = useCallback(
    async (name: string, email: string, password: string) => {
      setIsChecking(true);
      try {
        const res = await registerSirisoAccount(name, email, password);
        if (res.success && res.user) {
          const nextState = mapUserToProState(res.user, res.token);
          setProState(nextState);
          saveStoredProState(nextState);
          if (nextState.isPro) {
            if (pendingWorkspaceEntry) {
              completePendingWorkspaceEntry();
            }
          } else {
            // Free tier cannot enter workspace - must pay directly via QRIS
            setPendingWorkspaceEntry(true);
            setIsProModalOpen(true);
            if (res.token) {
              void createSirisoQrisPayment(res.token).then((qrisRes) => {
                if (qrisRes.success && qrisRes.order) {
                  setActiveQrisOrder(qrisRes.order);
                }
              });
            }
          }
          return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [pendingWorkspaceEntry, completePendingWorkspaceEntry],
  );

  const requestProUpgrade = useCallback(async () => {
    const token = proState.authToken || getStoredProState().authToken;
    if (!token) {
      return {
        success: false,
        message: "Silakan masuk ke akun Anda terlebih dahulu.",
      };
    }
    setIsChecking(true);
    try {
      const res = await requestSirisoProUpgrade(token);
      if (res.success && res.user) {
        const nextState = mapUserToProState(res.user, token);
        setProState(nextState);
        saveStoredProState(nextState);
        return { success: true, message: res.message };
      }
      return { success: false, message: res.message };
    } finally {
      setIsChecking(false);
    }
  }, [proState.authToken]);

  const createQrisPayment = useCallback(
    async (forceNew = false) => {
      const token = proState.authToken || getStoredProState().authToken;
      if (!token) {
        return {
          success: false,
          message: "Silakan masuk ke akun Siriso PDF terlebih dahulu.",
        };
      }
      setIsChecking(true);
      try {
        const res = await createSirisoQrisPayment(token, forceNew);
        if (res.success && res.order) {
          setActiveQrisOrder(res.order);
          if (res.user) {
            const nextState = mapUserToProState(res.user, token);
            setProState(nextState);
            saveStoredProState(nextState);
          }
          return {
            success: true,
            message: res.message,
            order: res.order,
          };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [proState.authToken],
  );

  const confirmQrisPayment = useCallback(
    async (orderId: string, payerNote?: string) => {
      const token = proState.authToken || getStoredProState().authToken;
      if (!token) {
        return {
          success: false,
          message: "Silakan masuk ke akun Siriso PDF terlebih dahulu.",
        };
      }
      setIsChecking(true);
      try {
        const res = await confirmSirisoQrisPayment(token, orderId, payerNote);
        if (res.success) {
          if (res.order) {
            setActiveQrisOrder(res.order);
          }
          if (res.user) {
            const nextState = mapUserToProState(res.user, token);
            setProState(nextState);
            saveStoredProState(nextState);
            if (nextState.isPro && pendingWorkspaceEntry) {
              completePendingWorkspaceEntry();
            }
          }
          return {
            success: true,
            message: res.message,
            order: res.order,
          };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [proState.authToken, pendingWorkspaceEntry, completePendingWorkspaceEntry],
  );

  const checkQrisPaymentStatus = useCallback(
    async (orderId?: string) => {
      const token = proState.authToken || getStoredProState().authToken;
      if (!token) return;
      const res = await fetchSirisoQrisPaymentStatus(
        token,
        orderId || activeQrisOrder?.orderId,
      );
      if (res.success) {
        if (res.order !== undefined) {
          setActiveQrisOrder(res.order);
        }
        if (res.user) {
          const nextState = mapUserToProState(res.user, token);
          setProState(nextState);
          saveStoredProState(nextState);
          if (nextState.isPro && pendingWorkspaceEntry) {
            completePendingWorkspaceEntry();
          }
        }
      }
    },
    [
      proState.authToken,
      activeQrisOrder?.orderId,
      pendingWorkspaceEntry,
      completePendingWorkspaceEntry,
    ],
  );

  const activateLicense = useCallback(
    async (licenseKey: string) => {
      setIsChecking(true);
      try {
        const res = await verifySirisoLicense(licenseKey);
        if (res.success && res.subscription) {
          const newState: SirisoProState = {
            isPro: true,
            proStatus: "active",
            licenseKey: res.subscription.licenseKey,
            desktopActivationCode: res.subscription.licenseKey,
            customerName: res.subscription.customerName,
            customerEmail: res.subscription.customerEmail,
            expiresAt: res.subscription.expiresAt,
            downloadsCount: res.subscription.downloadsCount,
          };
          setProState(newState);
          saveStoredProState(newState);
          if (pendingWorkspaceEntry) {
            completePendingWorkspaceEntry();
          }
          return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [pendingWorkspaceEntry, completePendingWorkspaceEntry],
  );

  const logoutAccount = useCallback(() => {
    clearStoredProState();
    setProState({ isPro: false });
    setActiveQrisOrder(null);
    setPendingWorkspaceEntry(false);
    pendingWorkspaceCallbackRef.current = null;
    setIsLandingOpen(true);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const SCRIPT_ID = "siriso-global-ad-script";
    const existing = document.getElementById(SCRIPT_ID);
    const raw = (adsConfig.globalHeadScript || "").trim();
    const isOfficialGoogleScript =
      raw.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js") &&
      /ca-pub-\d+/.test(raw);

    if (proState.isPro || !adsConfig.enabled || !isOfficialGoogleScript) {
      if (existing) {
        existing.remove();
      }
      return;
    }

    if (!existing && isOfficialGoogleScript) {
      try {
        const srcMatch = raw.match(/src=["']([^"']+)["']/i);
        if (
          srcMatch &&
          srcMatch[1] &&
          srcMatch[1].startsWith("https://pagead2.googlesyndication.com/")
        ) {
          const scriptEl = document.createElement("script");
          scriptEl.id = SCRIPT_ID;
          scriptEl.async = true;
          scriptEl.src = srcMatch[1];
          scriptEl.crossOrigin = "anonymous";
          document.head.appendChild(scriptEl);
        }
      } catch {
        // ignore injection errors
      }
    }
  }, [proState.isPro, adsConfig.enabled, adsConfig.globalHeadScript]);

  const value: SirisoProContextType = {
    isPro: Boolean(proState.isPro),
    isLoggedIn,
    proState,
    adsConfig,
    activeQrisOrder,
    isProModalOpen,
    setIsProModalOpen,
    openProModal,
    closeProModal,
    isLandingOpen,
    pendingWorkspaceEntry,
    openLandingPage,
    enterWorkspace,
    loginAccount,
    registerAccount,
    requestProUpgrade,
    createQrisPayment,
    confirmQrisPayment,
    checkQrisPaymentStatus,
    logoutAccount,
    activateLicense,
    deactivateLicense: logoutAccount,
    refreshStatus,
    isChecking,
  };

  return (
    <SirisoProContext.Provider value={value}>
      {children}
    </SirisoProContext.Provider>
  );
}

const fallbackContext: SirisoProContextType = {
  isPro: false,
  isLoggedIn: false,
  proState: { isPro: false },
  adsConfig: DEFAULT_ADS_CONFIG,
  activeQrisOrder: null,
  isProModalOpen: false,
  setIsProModalOpen: () => {},
  openProModal: () => {},
  closeProModal: () => {},
  isLandingOpen: false,
  pendingWorkspaceEntry: false,
  openLandingPage: () => {},
  enterWorkspace: (cb?: () => void) => cb?.(),
  loginAccount: async () => ({
    success: false,
    message: "Provider tidak aktif.",
  }),
  registerAccount: async () => ({
    success: false,
    message: "Provider tidak aktif.",
  }),
  requestProUpgrade: async () => ({
    success: false,
    message: "Provider tidak aktif.",
  }),
  createQrisPayment: async () => ({
    success: false,
    message: "Provider tidak aktif.",
  }),
  confirmQrisPayment: async () => ({
    success: false,
    message: "Provider tidak aktif.",
  }),
  checkQrisPaymentStatus: async () => {},
  logoutAccount: () => {},
  activateLicense: async () => ({
    success: false,
    message: "Provider tidak aktif.",
  }),
  deactivateLicense: () => {},
  refreshStatus: async () => {},
  isChecking: false,
};

export function useSirisoPro(): SirisoProContextType {
  const context = useContext(SirisoProContext);
  return context ?? fallbackContext;
}
