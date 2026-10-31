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
  computeAccess,
  confirmSirisoQrisPayment,
  createSirisoQrisPayment,
  DEFAULT_ACCESS_POLICY,
  DEFAULT_ADS_CONFIG,
  DEFAULT_PRICING,
  fetchSirisoAccountMe,
  fetchSirisoPublicConfig,
  fetchSirisoQrisPaymentStatus,
  getCachedPublicConfig,
  getStoredProState,
  loginSirisoAccount,
  mapUserToProState,
  registerSirisoAccount,
  requestSirisoProUpgrade,
  saveStoredProState,
  SIRISO_AUTH_STORAGE_KEY,
  SirisoAccessPolicy,
  SirisoAdsConfig,
  SirisoPricing,
  SirisoProState,
  SirisoProUser,
  SirisoQrisOrder,
  SirisoRole,
  verifySirisoLicense,
} from "@editor/services/sirisoProService";

export interface SirisoProContextType {
  isPro: boolean;
  isLoggedIn: boolean;
  /** Role assigned in the Siriso backoffice ("user" for customers). */
  role: SirisoRole;
  /** Admins see system settings and developer documentation. */
  isAdmin: boolean;
  /** Whether this visitor may open the workspace (role, Pro plan and backoffice policy). */
  canUseWorkspace: boolean;
  /** Pro customers, Tim and Admin never see ads. */
  isAdFree: boolean;
  proState: SirisoProState;
  adsConfig: SirisoAdsConfig;
  pricing: SirisoPricing;
  accessPolicy: SirisoAccessPolicy;
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
  /** Ends the session everywhere (this tab and others), closes the dialog and shows the landing page. */
  logoutAccount: () => void;
  activateLicense: (
    key: string,
  ) => Promise<{ success: boolean; message: string }>;
  deactivateLicense: () => void;
  refreshStatus: () => Promise<void>;
  isChecking: boolean;
}

const SirisoProContext = createContext<SirisoProContextType | null>(null);

/** How often an open tab re-checks the session with the server. */
const REVALIDATE_MS = 5 * 60 * 1000;

function hasAuthenticatedAccount(state: SirisoProState): boolean {
  return Boolean(state.authToken || state.customerEmail || state.isPro);
}

function getInitialPolicy(): SirisoAccessPolicy {
  return getCachedPublicConfig()?.access ?? DEFAULT_ACCESS_POLICY;
}

function getInitialLandingState(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.MODE === "test") return false;
  const access = computeAccess(getStoredProState(), getInitialPolicy());
  if (!access.workspace) return true;
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
  const [pricing, setPricing] = useState<SirisoPricing>(
    () => getCachedPublicConfig()?.pricing ?? DEFAULT_PRICING,
  );
  const [accessPolicy, setAccessPolicy] =
    useState<SirisoAccessPolicy>(getInitialPolicy);
  const [activeQrisOrder, setActiveQrisOrder] =
    useState<SirisoQrisOrder | null>(null);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isLandingOpen, setIsLandingOpen] = useState<boolean>(
    getInitialLandingState,
  );
  const [pendingWorkspaceEntry, setPendingWorkspaceEntry] = useState(false);
  const pendingWorkspaceCallbackRef = useRef<(() => void) | null>(null);
  const pendingEntryRef = useRef(false);
  const policyRef = useRef(accessPolicy);
  policyRef.current = accessPolicy;
  const [isChecking, setIsChecking] = useState(false);

  const access = computeAccess(proState, accessPolicy);
  const isLoggedIn = hasAuthenticatedAccount(proState);
  const isPro = Boolean(proState.isPro);
  const role: SirisoRole = proState.role ?? "user";

  const setPending = useCallback((pending: boolean) => {
    pendingEntryRef.current = pending;
    setPendingWorkspaceEntry(pending);
  }, []);

  const openProModal = useCallback(() => {
    setPending(false);
    pendingWorkspaceCallbackRef.current = null;
    setIsProModalOpen(true);
  }, [setPending]);

  const closeProModal = useCallback(() => {
    setIsProModalOpen(false);
    setPending(false);
    pendingWorkspaceCallbackRef.current = null;
  }, [setPending]);

  const openLandingPage = useCallback(() => setIsLandingOpen(true), []);

  const completePendingWorkspaceEntry = useCallback(() => {
    setIsLandingOpen(false);
    setPending(false);
    setIsProModalOpen(false);
    const cb = pendingWorkspaceCallbackRef.current;
    pendingWorkspaceCallbackRef.current = null;
    if (cb) {
      cb();
    }
  }, [setPending]);

  /** Drops the local session without touching dialogs (expired token, revoked account). */
  const dropSession = useCallback(() => {
    clearStoredProState();
    setProState({ isPro: false });
    setActiveQrisOrder(null);
  }, []);

  const applyUser = useCallback(
    (user: SirisoProUser, token?: string): SirisoProState => {
      const next = mapUserToProState(user, token);
      setProState(next);
      saveStoredProState(next);
      return next;
    },
    [],
  );

  const startQrisCheckout = useCallback((token: string) => {
    void createSirisoQrisPayment(token).then((res) => {
      if (res.success && res.order) {
        setActiveQrisOrder(res.order);
      }
    });
  }, []);

  /** After sign-in: open the workspace when allowed, otherwise go straight to checkout. */
  const afterSignIn = useCallback(
    (next: SirisoProState) => {
      if (computeAccess(next, policyRef.current).workspace) {
        if (pendingEntryRef.current) completePendingWorkspaceEntry();
        return;
      }
      setPending(true);
      setIsProModalOpen(true);
      if (next.authToken) startQrisCheckout(next.authToken);
    },
    [completePendingWorkspaceEntry, setPending, startQrisCheckout],
  );

  const enterWorkspace = useCallback(
    (onEntered?: () => void) => {
      if (access.workspace) {
        setIsLandingOpen(false);
        setPending(false);
        setIsProModalOpen(false);
        onEntered?.();
        return;
      }
      pendingWorkspaceCallbackRef.current = onEntered ?? null;
      setPending(true);
      setIsProModalOpen(true);
      if (isLoggedIn && !activeQrisOrder) {
        const token = proState.authToken || getStoredProState().authToken;
        if (token) startQrisCheckout(token);
      }
    },
    [
      access.workspace,
      isLoggedIn,
      activeQrisOrder,
      proState.authToken,
      setPending,
      startQrisCheckout,
    ],
  );

  /** Re-checks config and session with the server; `silent` skips the busy indicator. */
  const revalidate = useCallback(
    async (silent: boolean) => {
      if (!silent) setIsChecking(true);
      try {
        const config = await fetchSirisoPublicConfig();
        if (config) {
          setAdsConfig(config.ads);
          setPricing(config.pricing);
          setAccessPolicy(config.access);
        }

        const stored = getStoredProState();
        if (stored.authToken) {
          const me = await fetchSirisoAccountMe(stored.authToken);
          if (me.success && me.user) {
            applyUser(me.user, stored.authToken);
          } else if (me.invalid) {
            // Expired, forged or deleted session: never keep trusting the cached Pro flag
            dropSession();
          }
          return;
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
              expiresAt: res.subscription.expiresAt || undefined,
              downloadsCount: res.subscription.downloadsCount,
            };
            setProState(updated);
            saveStoredProState(updated);
          } else if (!res.networkError) {
            dropSession();
          }
          return;
        }

        // A Pro flag with neither a session nor a desktop code cannot be verified
        if (stored.isPro || stored.customerEmail) dropSession();
      } finally {
        if (!silent) setIsChecking(false);
      }
    },
    [applyUser, dropSession],
  );

  const refreshStatus = useCallback(() => revalidate(false), [revalidate]);

  const loginAccount = useCallback(
    async (email: string, password: string) => {
      setIsChecking(true);
      try {
        const res = await loginSirisoAccount(email, password);
        if (res.success && res.user) {
          afterSignIn(applyUser(res.user, res.token));
          return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [afterSignIn, applyUser],
  );

  const registerAccount = useCallback(
    async (name: string, email: string, password: string) => {
      setIsChecking(true);
      try {
        const res = await registerSirisoAccount(name, email, password);
        if (res.success && res.user) {
          afterSignIn(applyUser(res.user, res.token));
          return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [afterSignIn, applyUser],
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
        applyUser(res.user, token);
        return { success: true, message: res.message };
      }
      return { success: false, message: res.message };
    } finally {
      setIsChecking(false);
    }
  }, [proState.authToken, applyUser]);

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
          if (res.user) applyUser(res.user, token);
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
    [proState.authToken, applyUser],
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
            const next = applyUser(res.user, token);
            if (
              computeAccess(next, policyRef.current).workspace &&
              pendingEntryRef.current
            ) {
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
    [proState.authToken, applyUser, completePendingWorkspaceEntry],
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
          const next = applyUser(res.user, token);
          if (
            computeAccess(next, policyRef.current).workspace &&
            pendingEntryRef.current
          ) {
            completePendingWorkspaceEntry();
          }
        }
      }
    },
    [
      proState.authToken,
      activeQrisOrder?.orderId,
      applyUser,
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
            expiresAt: res.subscription.expiresAt || undefined,
            downloadsCount: res.subscription.downloadsCount,
          };
          setProState(newState);
          saveStoredProState(newState);
          if (pendingEntryRef.current) {
            completePendingWorkspaceEntry();
          }
          return { success: true, message: res.message };
        }
        return { success: false, message: res.message };
      } finally {
        setIsChecking(false);
      }
    },
    [completePendingWorkspaceEntry],
  );

  const logoutAccount = useCallback(() => {
    dropSession();
    setPending(false);
    pendingWorkspaceCallbackRef.current = null;
    setIsProModalOpen(false);
    setIsLandingOpen(true);
  }, [dropSession, setPending]);

  // Check on load, whenever the tab comes back, and periodically while it stays open.
  useEffect(() => {
    void revalidate(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void revalidate(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void revalidate(true), REVALIDATE_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [revalidate]);

  // Signing in or out in another tab applies here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SIRISO_AUTH_STORAGE_KEY) return;
      const next = getStoredProState();
      setProState(next);
      if (!hasAuthenticatedAccount(next)) {
        setActiveQrisOrder(null);
        setIsLandingOpen(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const SCRIPT_ID = "siriso-global-ad-script";
    const existing = document.getElementById(SCRIPT_ID);
    const raw = (adsConfig.globalHeadScript || "").trim();
    const isOfficialGoogleScript =
      raw.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js") &&
      /ca-pub-\d+/.test(raw);

    if (access.adFree || !adsConfig.enabled || !isOfficialGoogleScript) {
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
  }, [access.adFree, adsConfig.enabled, adsConfig.globalHeadScript]);

  const value: SirisoProContextType = {
    isPro,
    isLoggedIn,
    role,
    isAdmin: access.admin,
    canUseWorkspace: access.workspace,
    isAdFree: access.adFree,
    proState,
    adsConfig,
    pricing,
    accessPolicy,
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
  role: "user",
  isAdmin: false,
  canUseWorkspace: false,
  isAdFree: false,
  proState: { isPro: false },
  adsConfig: DEFAULT_ADS_CONFIG,
  pricing: DEFAULT_PRICING,
  accessPolicy: DEFAULT_ACCESS_POLICY,
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
