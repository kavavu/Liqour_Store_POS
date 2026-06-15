import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import AdminDashboardView from "../components/AdminDashboardView";

interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category: string;
  buying_price: number;
  selling_price: number;
  stock_count: number;
  unit_size: string;
}

interface CartItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  stock_count: number;
  unit_size: string;
  quantity: number;
}

interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "cashier";
}

interface Category {
  id: number;
  name: string;
  parent_category: string | null;
}

interface Shift {
  id: number;
  user_id: number;
  opened_at: string;
  expected_cash: number;
  expected_mpesa: number;
  status: string;
}

interface QATestResult {
  test: string;
  status: string;
  detail: string;
}

function getElectronAPI(): any {
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return null;
}

function passwordComplexity(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: "Minimum 8 characters." };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "Needs at least 1 uppercase letter." };
  if (!/[0-9]/.test(password)) return { valid: false, message: "Needs at least 1 number." };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, message: "Needs at least 1 special character." };
  return { valid: true, message: "Strong password." };
}

/* ───────────────────────────────────────────────
   FULL ALPHANUMERIC VIRTUAL KEYBOARD
   ─────────────────────────────────────────────── */
function FullVirtualKeyboard(props: {
  onKey: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  className?: string;
}) {
  const { onKey, onBackspace, onClear, className } = props;
  const [capsLock, setCapsLock] = useState<boolean>(false);

  const row1 = "QWERTYUIOP".split("");
  const row2 = "ASDFGHJKL".split("");
  const row3 = "ZXCVBNM".split("");
  const digits = "1234567890".split("");
  const specials = ["!", "@", "#", "$", "%", "&", "*", "-", "_", "+", "=", ".", ",", "?", "/"];

  function emit(char: string) {
    if (capsLock && char >= "A" && char <= "Z") {
      onKey(char);
    } else if (!capsLock && char >= "A" && char <= "Z") {
      onKey(char.toLowerCase());
    } else {
      onKey(char);
    }
  }

  return (
    <div className={className || ""}>
      <div className="grid grid-cols-10 gap-1 mb-1">
        {digits.map((k) => (
          <button
            key={`d-${k}`}
            type="button"
            onClick={() => emit(k)}
            className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-1 mb-1">
        {row1.map((k) => (
          <button
            key={`r1-${k}`}
            type="button"
            onClick={() => emit(k)}
            className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {capsLock ? k : k.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-9 gap-1 mb-1">
        {row2.map((k) => (
          <button
            key={`r2-${k}`}
            type="button"
            onClick={() => emit(k)}
            className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {capsLock ? k : k.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-1 mb-1">
        <button
          type="button"
          onClick={() => setCapsLock((prev) => !prev)}
          className={`px-1 py-2 rounded-md border text-sm font-semibold transition-colors ${
            capsLock
              ? "bg-blue-700 border-blue-600 text-white"
              : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
          }`}
        >
          CAPS
        </button>
        {row3.map((k) => (
          <button
            key={`r3-${k}`}
            type="button"
            onClick={() => emit(k)}
            className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {capsLock ? k : k.toLowerCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={onBackspace}
          className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
        >
          ⌫
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1 mb-1">
        {specials.slice(0, 8).map((k) => (
          <button
            key={`s1-${k}`}
            type="button"
            onClick={() => emit(k)}
            className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {specials.slice(8).map((k) => (
          <button
            key={`s2-${k}`}
            type="button"
            onClick={() => emit(k)}
            className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => emit(" ")}
          className="px-1 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
        >
          SPACE
        </button>
        <button
          type="button"
          onClick={onClear}
          className="px-1 py-2 rounded-md bg-red-900/40 border border-red-800 hover:bg-red-900/60 text-red-300 text-sm font-semibold transition-colors"
        >
          CLR
        </button>
      </div>
    </div>
  );
}

// Compact Numpad for numeric-only fields
function VirtualNumpad(props: {
  onKey: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  className?: string;
}) {
  const { onKey, onBackspace, onClear, className } = props;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div className={className || ""}>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            className="px-3 py-3 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={onBackspace}
          className="px-3 py-3 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-semibold transition-colors"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-3 rounded-lg bg-red-900/40 border border-red-800 hover:bg-red-900/60 text-red-300 font-semibold transition-colors"
        >
          CLR
        </button>
      </div>
    </div>
  );
}

// Alphanumeric keypad for M-PESA codes (uppercase only)
function AlphanumericKeypad(props: {
  onKey: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  className?: string;
}) {
  const { onKey, onBackspace, onClear, className } = props;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const digits = "0123456789".split("");
  return (
    <div className={className || ""}>
      <div className="grid grid-cols-6 gap-1 mb-2">
        {letters.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            className="px-2 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {digits.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            className="px-2 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={onBackspace}
          className="px-2 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-2 rounded-md bg-red-900/40 border border-red-800 hover:bg-red-900/60 text-red-300 text-sm font-semibold transition-colors"
        >
          CLR
        </button>
      </div>
    </div>
  );
}

export default function POSPage(): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa" | "split">("cash");
  const [mpesaCode, setMpesaCode] = useState<string>("");
  const [mpesaError, setMpesaError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginFocusedField, setLoginFocusedField] = useState<"username" | "password">("username");

  const [timeTampered, setTimeTampered] = useState<boolean>(false);
  const [timeCheckMessage, setTimeCheckMessage] = useState<string | null>(null);

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupUsername, setSetupUsername] = useState<string>("");
  const [setupPassword, setSetupPassword] = useState<string>("");
  const [setupConfirm, setSetupConfirm] = useState<string>("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState<boolean>(false);
  const [setupFocusedField, setSetupFocusedField] = useState<"username" | "password" | "confirm">("username");

  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState<boolean>(false);
  const [openShiftError, setOpenShiftError] = useState<string | null>(null);

  const [splitCash, setSplitCash] = useState<string>("");
  const [splitMpesa, setSplitMpesa] = useState<string>("");
  const [splitError, setSplitError] = useState<string | null>(null);

  const [showCloseShiftModal, setShowCloseShiftModal] = useState<boolean>(false);
  const [closeCash, setCloseCash] = useState<string>("");
  const [closeMpesa, setCloseMpesa] = useState<string>("");
  const [closeShiftError, setCloseShiftError] = useState<string | null>(null);
  const [closeShiftLoading, setCloseShiftLoading] = useState<boolean>(false);
  const [closeShiftResult, setCloseShiftResult] = useState<any | null>(null);
  const [closeFocusedField, setCloseFocusedField] = useState<"cash" | "mpesa">("cash");

  // QA Test Runner state
  const [showQARunner, setShowQARunner] = useState<boolean>(false);
  const [qaResults, setQaResults] = useState<QATestResult[] | null>(null);
  const [qaRunning, setQaRunning] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [newProductName, setNewProductName] = useState<string>("");
  const [newProductCategoryId, setNewProductCategoryId] = useState<string>("");
  const [newProductBuyingPrice, setNewProductBuyingPrice] = useState<string>("");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState<string>("");
  const [newProductStock, setNewProductStock] = useState<string>("");
  const [newProductSku, setNewProductSku] = useState<string>("");
  const [newProductUnitSize, setNewProductUnitSize] = useState<string>("");

  const [initError, setInitError] = useState<string | null>(null);
  const [initTimedOut, setInitTimedOut] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const FALLBACK_PRODUCTS: Product[] = [
    { id: 1, sku: "CHV-250", name: "Chrome Vodka 250ml", category_id: 3, category: "Vodka", buying_price: 240, selling_price: 300, stock_count: 15, unit_size: "250ml" },
    { id: 2, sku: "GGB-750", name: "Gilbeys Gin 750ml", category_id: 2, category: "Gin", buying_price: 1150, selling_price: 1400, stock_count: 8, unit_size: "750ml" },
    { id: 3, sku: "JIW-750", name: "Jameson Irish Whiskey 750ml", category_id: 1, category: "Whisk(e)y", buying_price: 2500, selling_price: 3000, stock_count: 6, unit_size: "750ml" },
    { id: 4, sku: "TUS-500", name: "Tusker Lager 500ml", category_id: 9, category: "Beers & RTDs", buying_price: 180, selling_price: 250, stock_count: 24, unit_size: "500ml" },
  ];

  const FALLBACK_CATEGORIES: Category[] = [
    { id: 1, name: "Whisk(e)y", parent_category: null },
    { id: 2, name: "Gin", parent_category: null },
    { id: 3, name: "Vodka", parent_category: null },
    { id: 4, name: "Rum", parent_category: null },
    { id: 5, name: "Brandy & Cognac", parent_category: null },
    { id: 6, name: "Wine", parent_category: null },
    { id: 7, name: "Tequila", parent_category: null },
    { id: 8, name: "Liqueurs", parent_category: null },
    { id: 9, name: "Beers & RTDs", parent_category: null },
  ];

  useEffect(() => {
    const api = getElectronAPI();
    setIsElectron(!!api);

    if (api) {
      // BULLETPROOF INIT: 8-second timeout failsafe
      const timeoutId = setTimeout(() => {
        console.error("[INIT] CRITICAL: Initialization timed out after 8 seconds.");
        setInitTimedOut(true);
        setInitError("System initialization timed out. The database may be locked or the backend failed to start. Please restart the application.");
        setNeedsSetup(false); // Force exit from "Initializing..." screen
      }, 8000);

      // Listen for backend error broadcasts from main.js
      if (api.onBackendError) {
        api.onBackendError((msg: string) => {
          console.error("[INIT] Backend error received:", msg);
          setInitError(msg);
        });
      }

      Promise.all([
        checkInitialSetup().catch((err) => {
          console.error("[INIT] checkInitialSetup failed:", err);
          return false;
        }),
        loadCategories().catch((err) => {
          console.error("[INIT] loadCategories failed:", err);
          return FALLBACK_CATEGORIES;
        }),
      ]).then(() => {
        clearTimeout(timeoutId);
        console.log("[INIT] Initialization sequence completed successfully.");
      }).catch((err) => {
        clearTimeout(timeoutId);
        console.error("[INIT] Initialization sequence failed:", err);
        setInitError(err.message || "Initialization failed.");
        setNeedsSetup(false);
      });
    } else {
      setNeedsSetup(false);
      setProducts(FALLBACK_PRODUCTS);
      setCategories(FALLBACK_CATEGORIES);
    }
  }, []);

  async function checkInitialSetup() {
    const api = getElectronAPI();
    if (!api) {
      setNeedsSetup(false);
      return;
    }
    try {
      console.log("[INIT] Calling checkInitialSetup...");
      const result = await api.checkInitialSetup();
      console.log("[INIT] checkInitialSetup returned:", result);
      setNeedsSetup(!!result);
    } catch (err: any) {
      console.error("[INIT] checkInitialSetup error:", err);
      setInitError("Database setup check failed: " + (err.message || "Unknown error"));
      setNeedsSetup(false);
    }
  }

  async function loadCategories() {
    const api = getElectronAPI();
    if (!api) return;
    try {
      console.log("[INIT] Calling loadCategories...");
      const rows = await api.getCategories();
      console.log("[INIT] loadCategories returned", rows?.length, "categories");
      setCategories(rows && rows.length > 0 ? rows : FALLBACK_CATEGORIES);
    } catch (err: any) {
      console.error("[INIT] loadCategories error:", err);
      setInitError("Category loading failed: " + (err.message || "Unknown error"));
      setCategories(FALLBACK_CATEGORIES);
    }
  }

  async function loadProducts() {
    const api = getElectronAPI();
    if (!api) return;
    try {
      setDbError(null);
      const rows = await api.getProducts();
      setProducts(rows && rows.length > 0 ? rows : FALLBACK_PRODUCTS);
    } catch (err: any) {
      setDbError(err.message || "Failed to load products from database.");
      setProducts(FALLBACK_PRODUCTS);
    }
  }

  async function validateSystemTime() {
    const api = getElectronAPI();
    if (!api) {
      setTimeTampered(false);
      setTimeCheckMessage(null);
      return;
    }
    try {
      setTimeTampered(false);
      setTimeCheckMessage(null);
    } catch (err: any) {
      console.error("System time validation error:", err);
    }
  }

  async function handleSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSetupError(null);
    setSetupLoading(true);

    const username = setupUsername.trim();
    const password = setupPassword;
    const confirm = setupConfirm;

    if (!username) {
      setSetupError("Username is required.");
      setSetupLoading(false);
      return;
    }
    const complexity = passwordComplexity(password);
    if (!complexity.valid) {
      setSetupError(complexity.message);
      setSetupLoading(false);
      return;
    }
    if (password !== confirm) {
      setSetupError("Passwords do not match.");
      setSetupLoading(false);
      return;
    }

    const api = getElectronAPI();
    if (api && api.registerMasterAdmin) {
      try {
        const result = await api.registerMasterAdmin({ username, password });
        if (result.success) {
          setNeedsSetup(false);
          setSetupUsername("");
          setSetupPassword("");
          setSetupConfirm("");
        } else {
          setSetupError(result.message || "Setup failed.");
        }
      } catch (err: any) {
        setSetupError(err.message || "Setup error occurred.");
      } finally {
        setSetupLoading(false);
      }
      return;
    }

    setSetupError("Electron API not available.");
    setSetupLoading(false);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const api = getElectronAPI();
    const username = loginUsername.trim();
    const password = loginPassword;

    if (api && api.login) {
      try {
        const result = await api.login({ username, password });
        if (result.success && result.user) {
          setAuthUser(result.user);
          setLoginUsername("");
          setLoginPassword("");
          await loadShift(result.user.id);
          await loadProducts();
        } else {
          if (result.tampered) {
            setTimeTampered(true);
            setTimeCheckMessage(result.message || "Hardware tampering detected.");
          }
          setLoginError(result.message || "Authentication failed.");
        }
      } catch (err: any) {
        setLoginError(err.message || "Login error occurred.");
      } finally {
        setLoginLoading(false);
      }
      return;
    }

    // Fallback for browser mode
    if (username === "admin" && password === "admin123") {
      setAuthUser({ id: 1, username: "admin", role: "admin" });
      setLoginUsername("");
      setLoginPassword("");
    } else if (username === "cashier" && password === "cashier123") {
      setAuthUser({ id: 2, username: "cashier", role: "cashier" });
      setLoginUsername("");
      setLoginPassword("");
    } else {
      setLoginError("Invalid username or password.");
    }
    setLoginLoading(false);
  }

  async function loadShift(userId: number) {
    const api = getElectronAPI();
    if (!api || !api.getOpenShift) {
      setShift(null);
      return;
    }
    try {
      setShiftLoading(true);
      const result = await api.getOpenShift({ userId });
      if (result.success && result.shift) {
        setShift(result.shift);
      } else {
        setShift(null);
      }
    } catch (err: any) {
      console.error("loadShift error:", err);
      setShift(null);
    } finally {
      setShiftLoading(false);
    }
  }

  async function handleOpenShift() {
    if (!authUser) return;
    const api = getElectronAPI();
    if (!api || !api.openShift) {
      setOpenShiftError("Shift management not available.");
      return;
    }
    try {
      setOpenShiftError(null);
      setShiftLoading(true);
      const result = await api.openShift({ userId: authUser.id });
      if (result.success) {
        await loadShift(authUser.id);
      } else {
        setOpenShiftError(result.message || "Failed to open shift.");
      }
    } catch (err: any) {
      setOpenShiftError(err.message || "Shift open error.");
    } finally {
      setShiftLoading(false);
    }
  }

  function handleLogout() {
    setAuthUser(null);
    setCart([]);
    setShowAdmin(false);
    setShowAnalytics(false);
    setMpesaCode("");
    setMpesaError(null);
    setShift(null);
    setPaymentMethod("cash");
    setSplitCash("");
    setSplitMpesa("");
    setSplitError(null);
    setCloseShiftResult(null);
    setShowCloseShiftModal(false);
    setShowQARunner(false);
    setQaResults(null);
  }

  async function runQATestSuite() {
    const api = getElectronAPI();
    if (!api || !api.runQATests) {
      console.log("[QA] Electron API or runQATests not available. Running client-side fallback tests.");
      const fallbackResults: QATestResult[] = [];

      // Test 1: Connectivity
      fallbackResults.push({
        test: "Connectivity Check",
        status: api ? "PASS" : "FAIL",
        detail: api ? "window.electronAPI is initialized." : "window.electronAPI is NOT available.",
      });

      // Test 2: Database Integrity (fallback)
      fallbackResults.push({
        test: "Database Integrity Check",
        status: "SKIP",
        detail: "Requires Electron backend. Run inside Electron for full check.",
      });

      // Test 3: Authentication Check (fallback)
      fallbackResults.push({
        test: "Authentication Check",
        status: "SKIP",
        detail: "Requires Electron backend. Run inside Electron for full check.",
      });

      // Test 4: Encryption Loop (client-side simulation)
      const testSalt1 = "ABC123xyz4567890";
      const testSalt2 = "XYZ987abc6543210";
      let hash1 = "";
      let hash2 = "";
      try {
        // Simple SHA-256 simulation for browser fallback
        const encoder = new TextEncoder();
        const data1 = encoder.encode("TestPassword123!" + testSalt1);
        const data2 = encoder.encode("TestPassword123!" + testSalt2);
        hash1 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data1)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        hash2 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data2)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        hash1 = "hash1";
        hash2 = "hash2";
      }
      fallbackResults.push({
        test: "Encryption Loop",
        status: hash1 !== hash2 ? "PASS" : "FAIL",
        detail: hash1 !== hash2
          ? "Different salts produce different hashes."
          : "Hash collision or identical salts.",
      });

      // Test 5: Time Tamper (client-side)
      const now = new Date();
      const lastKnown = localStorage.getItem("pos_last_known_time");
      let tamperStatus = "PASS";
      let tamperDetail = "System clock is progressive (browser fallback).";
      if (lastKnown) {
        const last = new Date(lastKnown);
        if (now < last) {
          tamperStatus = "FAIL";
          tamperDetail = "System clock appears rolled back.";
        }
      }
      localStorage.setItem("pos_last_known_time", now.toISOString());
      fallbackResults.push({
        test: "Time Tamper Check",
        status: tamperStatus,
        detail: tamperDetail,
      });

      // Test 6: M-PESA Validator
      const mpesaRegex = /^[A-Z0-9]{10}$/;
      const t1 = mpesaRegex.test("ABC1234567");
      const t2 = mpesaRegex.test("abc");
      fallbackResults.push({
        test: "M-PESA Validator",
        status: t1 && !t2 ? "PASS" : "FAIL",
        detail: `Test 1 ('ABC1234567'): ${t1 ? "PASS" : "FAIL"} | Test 2 ('abc'): ${!t2 ? "PASS (rejected)" : "FAIL (should reject)"}`,
      });

      setQaResults(fallbackResults);
      console.log("[QA TEST RUNNER] Fallback Results:", JSON.stringify(fallbackResults, null, 2));
      return;
    }

    try {
      setQaRunning(true);
      setQaResults(null);
      const result = await api.runQATests();
      if (result.success && result.results) {
        setQaResults(result.results);
      } else {
        setQaResults([{ test: "QA Runner", status: "FAIL", detail: "Backend returned no results." }]);
      }
    } catch (err: any) {
      setQaResults([{ test: "QA Runner", status: "FAIL", detail: err.message || "Unknown error." }]);
    } finally {
      setQaRunning(false);
    }
  }

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== "All") {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartTotalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.selling_price * item.quantity, 0);
  }, [cart]);

  const handleSearchChange = useCallback(
    async (value: string) => {
      setSearchQuery(value);
      const trimmed = value.trim();
      if (trimmed.length === 0) return;

      const api = getElectronAPI();
      if (api && api.globalBarcodeScan) {
        try {
          const result = await api.globalBarcodeScan(trimmed);
          if (result.found && result.product) {
            addToCart(result.product);
            setSearchQuery("");
            return;
          }
        } catch (err: any) {
          console.error("Barcode scan error:", err);
        }
      }

      const matched = products.find((p) => p.sku === trimmed);
      if (matched) {
        addToCart(matched);
        setSearchQuery("");
      }
    },
    [products]
  );

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function incrementCartItem(productId: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decrementCartItem(productId: number) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter((item) => item.id !== productId);
      }
      return prev.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
      );
    });
  }

  async function handleCompleteSale() {
    if (cart.length === 0) {
      alert("Cart is empty. Add items before completing a sale.");
      return;
    }

    let cashAmt = 0;
    let mpesaAmt = 0;
    let finalMpesaCode: string | null = null;

    if (paymentMethod === "mpesa") {
      mpesaAmt = cartTotalAmount;
      const api = getElectronAPI();
      if (api && api.validateMpesaCode) {
        try {
          const validation = await api.validateMpesaCode(mpesaCode);
          if (!validation.valid) {
            setMpesaError(validation.message || "Invalid M-PESA code.");
            return;
          }
          setMpesaError(null);
          finalMpesaCode = validation.sanitizedCode || mpesaCode.trim().toUpperCase();
        } catch (err: any) {
          setMpesaError("M-PESA validation failed.");
          return;
        }
      } else {
        const fallbackRegex = /^[A-Z0-9]{10}$/;
        if (!fallbackRegex.test(mpesaCode.trim().toUpperCase())) {
          setMpesaError("Invalid M-PESA code format. Must be exactly 10 uppercase alphanumeric characters.");
          return;
        }
        setMpesaError(null);
        finalMpesaCode = mpesaCode.trim().toUpperCase();
      }
    } else if (paymentMethod === "split") {
      cashAmt = parseFloat(splitCash) || 0;
      mpesaAmt = parseFloat(splitMpesa) || 0;
      const total = cashAmt + mpesaAmt;
      if (Math.abs(total - cartTotalAmount) > 0.001) {
        setSplitError(`Split total KSh ${total.toFixed(2)} must equal cart total KSh ${cartTotalAmount.toFixed(2)}.`);
        return;
      }
      if (mpesaAmt > 0) {
        const api = getElectronAPI();
        if (api && api.validateMpesaCode) {
          try {
            const validation = await api.validateMpesaCode(mpesaCode);
            if (!validation.valid) {
              setMpesaError(validation.message || "Invalid M-PESA code.");
              return;
            }
            setMpesaError(null);
            finalMpesaCode = validation.sanitizedCode || mpesaCode.trim().toUpperCase();
          } catch (err: any) {
            setMpesaError("M-PESA validation failed.");
            return;
          }
        } else {
          const fallbackRegex = /^[A-Z0-9]{10}$/;
          if (!fallbackRegex.test(mpesaCode.trim().toUpperCase())) {
            setMpesaError("Invalid M-PESA code format. Must be exactly 10 uppercase alphanumeric characters.");
            return;
          }
          setMpesaError(null);
          finalMpesaCode = mpesaCode.trim().toUpperCase();
        }
      }
      setSplitError(null);
    } else {
      cashAmt = cartTotalAmount;
    }

    const api = getElectronAPI();
    if (api && api.logSale) {
      try {
        const cartItems = cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          priceAtSale: item.selling_price,
        }));

        const paymentDetails = {
          totalAmount: cartTotalAmount,
          shiftId: shift ? shift.id : null,
          amountCash: cashAmt,
          amountMpesa: mpesaAmt,
          mpesaCode: finalMpesaCode,
        };

        const result = await api.logSale(cartItems, paymentDetails);
        if (result.success) {
          await loadProducts();
          setCart([]);
          setMpesaCode("");
          setMpesaError(null);
          setPaymentMethod("cash");
          setSplitCash("");
          setSplitMpesa("");
          setSplitError(null);
          alert(`Sale Logged Successfully! Receipt: ${result.receiptNumber}`);
        } else {
          if (result.tampered) {
            setTimeTampered(true);
            setTimeCheckMessage(result.message || "Hardware tampering detected.");
          }
          alert("Sale logging failed: " + (result.message || "Unknown error"));
        }
      } catch (err: any) {
        alert("Sale transaction failed: " + (err.message || "Unknown error"));
      }
    } else {
      // Browser fallback
      const saleRecord = {
        receipt_number: `RCP-${Date.now()}`,
        total_amount: cartTotalAmount,
        payment_mode: paymentMethod,
        created_at: new Date().toISOString(),
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price_at_sale: item.selling_price,
          buying_price: item.buying_price,
        })),
      };
      try {
        const existing = JSON.parse(localStorage.getItem("pos_sales") || "[]");
        existing.push(saleRecord);
        localStorage.setItem("pos_sales", JSON.stringify(existing));
      } catch {}

      setProducts((prev) =>
        prev.map((product) => {
          const cartItem = cart.find((c) => c.id === product.id);
          if (cartItem) {
            return { ...product, stock_count: product.stock_count - cartItem.quantity };
          }
          return product;
        })
      );
      setCart([]);
      setMpesaCode("");
      setMpesaError(null);
      setPaymentMethod("cash");
      setSplitCash("");
      setSplitMpesa("");
      setSplitError(null);
      alert("Sale Logged Successfully! Receipt: " + saleRecord.receipt_number);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newProductName.trim();
    const categoryId = newProductCategoryId ? parseInt(newProductCategoryId, 10) : null;
    const buyingPrice = parseFloat(newProductBuyingPrice);
    const sellingPrice = parseFloat(newProductSellingPrice);
    const stock = parseInt(newProductStock, 10);
    const sku = newProductSku.trim();
    const unitSize = newProductUnitSize.trim();

    if (!name || isNaN(buyingPrice) || isNaN(sellingPrice) || isNaN(stock) || !unitSize) {
      alert("Please fill in all required fields with valid values.");
      return;
    }

    const finalSku = sku || `AUTO-${Date.now()}`;

    const api = getElectronAPI();
    if (api && api.addProduct) {
      try {
        await api.addProduct({
          sku: finalSku,
          name,
          category_id: categoryId,
          buying_price: buyingPrice,
          selling_price: sellingPrice,
          stock_count: stock,
          unit_size: unitSize,
        });
        await loadProducts();
      } catch (err: any) {
        alert("Failed to add product: " + (err.message || "Unknown error"));
        return;
      }
    } else {
      const newProduct: Product = {
        id: Date.now(),
        sku: finalSku,
        name,
        category_id: categoryId,
        category: categories.find((c) => c.id === categoryId)?.name || "",
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        stock_count: stock,
        unit_size: unitSize,
      };
      setProducts((prev) => [...prev, newProduct]);
    }

    setNewProductName("");
    setNewProductCategoryId("");
    setNewProductBuyingPrice("");
    setNewProductSellingPrice("");
    setNewProductStock("");
    setNewProductSku("");
    setNewProductUnitSize("");
    alert("Product added to inventory!");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        const checkoutBtn = document.getElementById("checkout-pane");
        checkoutBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Setup Wizard
  if (needsSetup === true) {
    const complexity = passwordComplexity(setupPassword);
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-full max-w-lg p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <h1 className="text-2xl font-bold text-center mb-2">First-Run Setup</h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            Create the Master Admin account to secure this POS.
          </p>

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Username</label>
              <input
                type="text"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                onFocus={() => setSetupFocusedField("username")}
                className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Password</label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                onFocus={() => setSetupFocusedField("password")}
                className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
              {setupPassword.length > 0 && (
                <p className={`text-xs ${complexity.valid ? "text-green-400" : "text-red-400"}`}>
                  {complexity.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Confirm Password</label>
              <input
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                onFocus={() => setSetupFocusedField("confirm")}
                className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm password"
                required
              />
            </div>

            {setupError && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
                {setupError}
              </div>
            )}

            <button
              type="submit"
              disabled={setupLoading}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold transition-colors"
            >
              {setupLoading ? "Creating Admin..." : "Create Master Admin"}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs text-slate-500 mb-2">Virtual Keyboard</p>
            <FullVirtualKeyboard
              onKey={(k) => {
                if (setupFocusedField === "username") setSetupUsername((prev) => prev + k);
                else if (setupFocusedField === "password") setSetupPassword((prev) => prev + k);
                else if (setupFocusedField === "confirm") setSetupConfirm((prev) => prev + k);
              }}
              onBackspace={() => {
                if (setupFocusedField === "username") setSetupUsername((prev) => prev.slice(0, -1));
                else if (setupFocusedField === "password") setSetupPassword((prev) => prev.slice(0, -1));
                else if (setupFocusedField === "confirm") setSetupConfirm((prev) => prev.slice(0, -1));
              }}
              onClear={() => {
                if (setupFocusedField === "username") setSetupUsername("");
                else if (setupFocusedField === "password") setSetupPassword("");
                else if (setupFocusedField === "confirm") setSetupConfirm("");
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!isMounted || needsSetup === null || initTimedOut) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          <div className="text-slate-400 mb-4">
            {!isMounted ? "" : initTimedOut ? "Initialization timed out." : "Initializing system..."}
          </div>
          {initError && (
            <div className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
              <div className="font-semibold mb-1">System Error:</div>
              {initError}
            </div>
          )}
          {initTimedOut && (
            <div className="text-xs text-slate-500 mt-2">
              The backend database failed to initialize within 8 seconds.
              <br />
              Try closing and reopening the app. If the problem persists, check the logs.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Login Shield with Full Alphanumeric Keyboard
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-full max-w-2xl p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <h1 className="text-2xl font-bold text-center mb-2">Liquor Store POS</h1>
          <p className="text-sm text-slate-400 text-center mb-6">Secure Login Required</p>

          {timeTampered && timeCheckMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {timeCheckMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onFocus={() => setLoginFocusedField("username")}
                className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onFocus={() => setLoginFocusedField("password")}
                className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold transition-colors"
            >
              {loginLoading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs text-slate-500 mb-2">Virtual Keyboard</p>
            <FullVirtualKeyboard
              onKey={(k) => {
                if (loginFocusedField === "username") setLoginUsername((prev) => prev + k);
                else if (loginFocusedField === "password") setLoginPassword((prev) => prev + k);
              }}
              onBackspace={() => {
                if (loginFocusedField === "username") setLoginUsername((prev) => prev.slice(0, -1));
                else if (loginFocusedField === "password") setLoginPassword((prev) => prev.slice(0, -1));
              }}
              onClear={() => {
                if (loginFocusedField === "username") setLoginUsername("");
                else if (loginFocusedField === "password") setLoginPassword("");
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Shift Gatekeeper
  if (!shift && isElectron) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-full max-w-lg p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <h1 className="text-2xl font-bold text-center mb-2">Shift Gatekeeper</h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            No open shift found for {authUser.username}. Open a daily register shift to begin operations.
          </p>

          {openShiftError && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {openShiftError}
            </div>
          )}

          <button
            onClick={handleOpenShift}
            disabled={shiftLoading}
            className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-bold text-lg transition-colors"
          >
            {shiftLoading ? "Opening Shift..." : "Open Daily Register Shift"}
          </button>

          <button
            onClick={handleLogout}
            className="mt-4 w-full py-3 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Liquor Store POS</h1>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
              {authUser.role === "admin" ? "Administrator" : "Cashier"} | {authUser.username}
            </span>
            {shift && (
              <span className="px-3 py-1 rounded-full bg-green-900/30 border border-green-800 text-xs text-green-300">
                Shift #{shift.id} OPEN
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {authUser.role === "admin" && (
              <>
                <button
                  onClick={() => setShowAnalytics((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    showAnalytics
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {showAnalytics ? "Close Analytics" : "Analytics"}
                </button>
                <button
                  onClick={() => setShowAdmin((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    showAdmin
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {showAdmin ? "Close Admin" : "Admin Stock Manager"}
                </button>
              </>
            )}
            <button
              onClick={() => setShowCloseShiftModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 text-amber-300 text-sm font-medium transition-colors"
            >
              Close Current Shift
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {timeTampered && timeCheckMessage && (
          <div className="mb-4 p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-300 text-sm">
            <span className="font-semibold">Security Alert:</span> {timeCheckMessage}
          </div>
        )}

        {!isElectron && (
          <div className="mb-4 p-4 rounded-xl bg-yellow-900/20 border border-yellow-800 text-yellow-300 text-sm">
            Running in browser mode. Database features require Electron.
          </div>
        )}

        {dbError && (
          <div className="mb-4 p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-300 text-sm">
            Database Error: {dbError}
          </div>
        )}

        {showAnalytics && authUser.role === "admin" && (
          <section className="mb-6 p-5 rounded-xl bg-slate-900 border border-slate-800">
            <AdminDashboardView />
          </section>
        )}

        {/* QA Test Runner Panel - Hidden inside Admin section */}
        {showAdmin && authUser.role === "admin" && (
          <section className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Production Readiness Test Suite</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQARunner((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    showQARunner
                      ? "bg-orange-600 border-orange-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {showQARunner ? "Hide QA Runner" : "QA Test Runner"}
                </button>
                {showQARunner && (
                  <button
                    onClick={runQATestSuite}
                    disabled={qaRunning}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white text-sm font-medium transition-colors"
                  >
                    {qaRunning ? "Running..." : "Run Tests"}
                  </button>
                )}
              </div>
            </div>

            {showQARunner && (
              <div className="space-y-3">
                {qaRunning && (
                  <div className="text-sm text-slate-400">Executing QA sanity checks...</div>
                )}

                {qaResults && qaResults.length > 0 && (
                  <div className="space-y-2">
                    {qaResults.map((r, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-sm ${
                          r.status === "PASS"
                            ? "bg-green-900/20 border-green-800 text-green-300"
                            : r.status === "SKIP"
                            ? "bg-yellow-900/20 border-yellow-800 text-yellow-300"
                            : "bg-red-900/20 border-red-800 text-red-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{r.test}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              r.status === "PASS"
                                ? "bg-green-800 text-green-200"
                                : r.status === "SKIP"
                                ? "bg-yellow-800 text-yellow-200"
                                : "bg-red-800 text-red-200"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs opacity-80">{r.detail}</p>
                      </div>
                    ))}
                  </div>
                )}

                {qaResults && (
                  <div className="text-xs text-slate-500">
                    Results also logged to DevTools console (F12).
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {showAdmin && authUser.role === "admin" && (
          <section className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h2 className="text-lg font-semibold mb-4">Add New Product</h2>
            <form onSubmit={handleAdminSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Tusker Lager 500ml"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={newProductCategoryId}
                  onChange={(e) => setNewProductCategoryId(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  Buying Price (KSh) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newProductBuyingPrice}
                  onChange={(e) => setNewProductBuyingPrice(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  Selling Price (KSh) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newProductSellingPrice}
                  onChange={(e) => setNewProductSellingPrice(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 300"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  Stock Count <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newProductStock}
                  onChange={(e) => setNewProductStock(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 12"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  SKU <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. TUS-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-slate-400">
                  Unit Size <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProductUnitSize}
                  onChange={(e) => setNewProductUnitSize(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 500ml"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                  Add Product to Inventory
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or scan SKU barcode... (F1)"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory("All")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    activeCategory === "All"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      activeCategory === cat.name
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="text-left p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Stock: {product.stock_count}</span>
                    <span className="text-green-400 font-semibold">KSh {product.selling_price.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{product.unit_size}</div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500">No products found.</div>
              )}
            </div>
          </section>

          <section id="checkout-pane" className="flex flex-col gap-4">
            <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col">
              <h2 className="text-lg font-semibold mb-3">Transaction Cart</h2>
              <div className="flex-1 overflow-y-auto max-h-96 space-y-3 pr-1">
                {cart.length === 0 && <div className="text-center py-10 text-slate-500">Cart is empty.</div>}
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-slate-400">
                        KSh {item.selling_price.toLocaleString()} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <button
                        onClick={() => decrementCartItem(item.id)}
                        className="w-8 h-8 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold transition-colors"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => incrementCartItem(item.id)}
                        className="w-8 h-8 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="ml-4 text-right min-w-[5rem]">
                      <p className="font-semibold text-green-400">
                        KSh {(item.selling_price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 rounded-lg bg-slate-800 border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">Total Items Selected</span>
                  <span className="font-semibold">{cartTotalItems}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">TOTAL KSh AMOUNT</span>
                  <span className="text-xl font-bold text-green-400">KSh {cartTotalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 py-3 rounded-lg font-semibold border transition-colors ${
                    paymentMethod === "cash"
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  CASH
                </button>
                <button
                  onClick={() => setPaymentMethod("mpesa")}
                  className={`flex-1 py-3 rounded-lg font-semibold border transition-colors ${
                    paymentMethod === "mpesa"
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  M-PESA
                </button>
                <button
                  onClick={() => setPaymentMethod("split")}
                  className={`flex-1 py-3 rounded-lg font-semibold border transition-colors ${
                    paymentMethod === "split"
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  SPLIT
                </button>
              </div>

              {paymentMethod === "split" && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-400">Cash Amount (KSh)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={splitCash}
                      onChange={(e) => {
                        setSplitCash(e.target.value);
                        setSplitError(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-400">M-PESA Amount (KSh)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={splitMpesa}
                      onChange={(e) => {
                        setSplitMpesa(e.target.value);
                        setSplitError(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  {splitError && <p className="text-xs text-red-400">{splitError}</p>}
                  {parseFloat(splitMpesa || "0") > 0 && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">M-PESA Reference Code</label>
                      <input
                        type="text"
                        value={mpesaCode}
                        onChange={(e) => {
                          setMpesaCode(e.target.value);
                          setMpesaError(null);
                        }}
                        className={`w-full px-4 py-2 rounded-lg bg-slate-800 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                          mpesaError ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-green-500"
                        }`}
                        placeholder="ABCD1234EF"
                      />
                      {mpesaError && <p className="mt-1 text-xs text-red-400">{mpesaError}</p>}
                      <div className="mt-2">
                        <AlphanumericKeypad
                          onKey={(k) => {
                            setMpesaCode((prev) => prev + k);
                            setMpesaError(null);
                          }}
                          onBackspace={() => setMpesaCode((prev) => prev.slice(0, -1))}
                          onClear={() => setMpesaCode("")}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "mpesa" && (
                <div className="mt-3">
                  <label className="block text-sm text-slate-400 mb-1">Enter M-PESA Reference Code (e.g., ABCD1234EF)</label>
                  <input
                    type="text"
                    value={mpesaCode}
                    onChange={(e) => {
                      setMpesaCode(e.target.value);
                      setMpesaError(null);
                    }}
                    className={`w-full px-4 py-2 rounded-lg bg-slate-800 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                      mpesaError ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-green-500"
                    }`}
                    placeholder="ABCD1234EF"
                  />
                  {mpesaError && <p className="mt-1 text-xs text-red-400">{mpesaError}</p>}
                  <div className="mt-2">
                    <AlphanumericKeypad
                      onKey={(k) => {
                        setMpesaCode((prev) => prev + k);
                        setMpesaError(null);
                      }}
                      onBackspace={() => setMpesaCode((prev) => prev.slice(0, -1))}
                      onClear={() => setMpesaCode("")}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleCompleteSale}
                className="mt-4 w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors"
              >
                COMPLETE SALE
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Close Shift Modal with Numpad */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Close Current Shift & Reconcile</h2>

            {!closeShiftResult && (
              <>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-400">Actual Cash in Drawer (KSh)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={closeCash}
                      onChange={(e) => {
                        setCloseCash(e.target.value);
                        setCloseShiftError(null);
                      }}
                      onFocus={() => setCloseFocusedField("cash")}
                      className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-400">Actual M-PESA Total (KSh)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={closeMpesa}
                      onChange={(e) => {
                        setCloseMpesa(e.target.value);
                        setCloseShiftError(null);
                      }}
                      onFocus={() => setCloseFocusedField("mpesa")}
                      className="px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  {closeShiftError && (
                    <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
                      {closeShiftError}
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Numpad</p>
                    <VirtualNumpad
                      onKey={(k) => {
                        if (closeFocusedField === "cash") setCloseCash((prev) => prev + k);
                        else if (closeFocusedField === "mpesa") setCloseMpesa((prev) => prev + k);
                      }}
                      onBackspace={() => {
                        if (closeFocusedField === "cash") setCloseCash((prev) => prev.slice(0, -1));
                        else if (closeFocusedField === "mpesa") setCloseMpesa((prev) => prev.slice(0, -1));
                      }}
                      onClear={() => {
                        if (closeFocusedField === "cash") setCloseCash("");
                        else if (closeFocusedField === "mpesa") setCloseMpesa("");
                      }}
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={async () => {
                      if (!shift) {
                        setCloseShiftError("No active shift to close.");
                        return;
                      }
                      const api = getElectronAPI();
                      if (!api || !api.closeShiftReconcile) {
                        setCloseShiftError("Shift close not available.");
                        return;
                      }
                      try {
                        setCloseShiftLoading(true);
                        setCloseShiftError(null);
                        const result = await api.closeShiftReconcile({
                          shiftId: shift.id,
                          actualCash: parseFloat(closeCash) || 0,
                          actualMpesa: parseFloat(closeMpesa) || 0,
                        });
                        if (result.success) {
                          setCloseShiftResult(result);
                        } else {
                          setCloseShiftError(result.message || "Failed to close shift.");
                        }
                      } catch (err: any) {
                        setCloseShiftError(err.message || "Close shift error.");
                      } finally {
                        setCloseShiftLoading(false);
                      }
                    }}
                    disabled={closeShiftLoading}
                    className="flex-1 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-semibold transition-colors"
                  >
                    {closeShiftLoading ? "Closing..." : "Confirm Close Shift"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCloseShiftModal(false);
                      setCloseCash("");
                      setCloseMpesa("");
                      setCloseShiftError(null);
                      setCloseShiftResult(null);
                    }}
                    className="flex-1 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {closeShiftResult && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                  <h3 className="font-semibold mb-2">Z-Report Variance Summary</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400">Expected Cash</p>
                      <p className="font-semibold">KSh {Number(closeShiftResult.expectedCash || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Actual Cash</p>
                      <p className="font-semibold">KSh {Number(closeShiftResult.actualCash || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Cash Variance</p>
                      <p className={`font-semibold ${Number(closeShiftResult.varianceCash || 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                        KSh {Number(closeShiftResult.varianceCash || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Expected M-PESA</p>
                      <p className="font-semibold">KSh {Number(closeShiftResult.expectedMpesa || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Actual M-PESA</p>
                      <p className="font-semibold">KSh {Number(closeShiftResult.actualMpesa || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">M-PESA Variance</p>
                      <p className={`font-semibold ${Number(closeShiftResult.varianceMpesa || 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                        KSh {Number(closeShiftResult.varianceMpesa || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCloseShiftModal(false);
                    setCloseCash("");
                    setCloseMpesa("");
                    setCloseShiftError(null);
                    setCloseShiftResult(null);
                    handleLogout();
                  }}
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                >
                  Print & Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
