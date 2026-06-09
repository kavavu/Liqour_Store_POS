import React, { useState, useMemo, useEffect, useCallback } from "react";
import AdminDashboardView from "../components/AdminDashboardView";

interface Product {
  id: number;
  barcode_sku: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  stock_count: number;
}

interface CartItem {
  id: number;
  barcode_sku: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  stock_count: number;
  quantity: number;
}

interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "cashier";
}

const CATEGORIES = ["All", "Gin", "Vodka", "Rum", "Beer"];

function getElectronAPI(): any {
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return null;
}

export default function POSPage(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa">("cash");
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

  const FALLBACK_USERS: AuthUser[] = [
    { id: 1, username: "admin", role: "admin" },
    { id: 2, username: "cashier", role: "cashier" },
  ];

  const [timeTampered, setTimeTampered] = useState<boolean>(false);
  const [timeCheckMessage, setTimeCheckMessage] = useState<string | null>(null);

  const [newProductName, setNewProductName] = useState<string>("");
  const [newProductCategory, setNewProductCategory] = useState<string>("Gin");
  const [newProductBuyingPrice, setNewProductBuyingPrice] = useState<string>("");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState<string>("");
  const [newProductStock, setNewProductStock] = useState<string>("");
  const [newProductSku, setNewProductSku] = useState<string>("");

  const FALLBACK_PRODUCTS: Product[] = [
    {
      id: 1,
      barcode_sku: "1111",
      name: "Chrome Vodka 250ml",
      category: "Vodka",
      buying_price: 240,
      selling_price: 300,
      stock_count: 15,
    },
    {
      id: 2,
      barcode_sku: "2222",
      name: "Gilbeys Gin 750ml",
      category: "Gin",
      buying_price: 1150,
      selling_price: 1400,
      stock_count: 8,
    },
    {
      id: 3,
      barcode_sku: "3333",
      name: "Captain Morgan 750ml",
      category: "Rum",
      buying_price: 1300,
      selling_price: 1600,
      stock_count: 5,
    },
    {
      id: 4,
      barcode_sku: "4444",
      name: "White Cap Lager",
      category: "Beer",
      buying_price: 240,
      selling_price: 300,
      stock_count: 24,
    },
  ];

  useEffect(() => {
    const api = getElectronAPI();
    setIsElectron(!!api);

    if (api) {
      loadProducts();
      validateSystemTime();
    } else {
      setProducts(FALLBACK_PRODUCTS);
    }
  }, []);

  async function loadProducts() {
    const api = getElectronAPI();
    if (!api) return;
    try {
      setDbError(null);
      const rows = await api.getProducts();
      setProducts(rows);
    } catch (err: any) {
      setDbError(err.message || "Failed to load products from database.");
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
      const result = await api.validateSystemTime();
      if (result.tampered) {
        setTimeTampered(true);
        setTimeCheckMessage(result.message || "System clock tampering detected.");
      } else {
        setTimeTampered(false);
        setTimeCheckMessage(null);
      }
    } catch (err: any) {
      console.error("System time validation error:", err);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const api = getElectronAPI();
    const username = loginUsername.trim();
    const password = loginPassword;

    if (api && api.authenticateUser) {
      try {
        const result = await api.authenticateUser({ username, password });
        if (result.success && result.user) {
          setAuthUser(result.user);
          setLoginUsername("");
          setLoginPassword("");
        } else {
          setLoginError(result.message || "Authentication failed.");
        }
      } catch (err: any) {
        setLoginError(err.message || "Login error occurred.");
      } finally {
        setLoginLoading(false);
      }
      return;
    }

    const fallbackUser = FALLBACK_USERS.find((u) => u.username === username);
    if (
      fallbackUser &&
      ((username === "admin" && password === "admin123") ||
        (username === "cashier" && password === "cashier123"))
    ) {
      setAuthUser(fallbackUser);
      setLoginUsername("");
      setLoginPassword("");
    } else {
      setLoginError("Invalid username or password.");
    }
    setLoginLoading(false);
  }

  function handleLogout() {
    setAuthUser(null);
    setCart([]);
    setShowAdmin(false);
    setShowAnalytics(false);
    setMpesaCode("");
    setMpesaError(null);
  }

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== "All") {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartTotalAmount = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.selling_price * item.quantity,
      0
    );
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

      const matched = products.find((p) => p.barcode_sku === trimmed);
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
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function incrementCartItem(productId: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
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
        item.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      );
    });
  }

  async function handleCompleteSale() {
    if (cart.length === 0) {
      alert("Cart is empty. Add items before completing a sale.");
      return;
    }

    if (paymentMethod === "mpesa") {
      const api = getElectronAPI();
      if (api && api.validateMpesaCode) {
        try {
          const validation = await api.validateMpesaCode(mpesaCode);
          if (!validation.valid) {
            setMpesaError(validation.message || "Invalid M-PESA code.");
            return;
          }
          setMpesaError(null);
          setMpesaCode(validation.sanitizedCode || mpesaCode);
        } catch (err: any) {
          setMpesaError("M-PESA validation failed.");
          return;
        }
      } else {
        const fallbackRegex = /^[A-Z0-9]{6,12}$/;
        if (!fallbackRegex.test(mpesaCode.trim().toUpperCase())) {
          setMpesaError(
            "Invalid M-PESA code format. Must be 6-12 alphanumeric characters (e.g., TFX987X)."
          );
          return;
        }
        setMpesaError(null);
      }
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
          paymentMode: paymentMethod,
          mpesaCode: paymentMethod === "mpesa" ? mpesaCode : null,
          cashierId: authUser ? String(authUser.id) : null,
        };

        const result = await api.logSale(cartItems, paymentDetails);
        if (result.success) {
          await loadProducts();
          setCart([]);
          setMpesaCode("");
          setMpesaError(null);
          setPaymentMethod("cash");
          alert(
            `Sale Logged Successfully! Receipt: ${result.receiptNumber}`
          );
        } else {
          alert("Sale logging failed.");
        }
      } catch (err: any) {
        alert("Sale transaction failed: " + (err.message || "Unknown error"));
      }
    } else {
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
            return {
              ...product,
              stock_count: product.stock_count - cartItem.quantity,
            };
          }
          return product;
        })
      );
      setCart([]);
      setMpesaCode("");
      setMpesaError(null);
      setPaymentMethod("cash");
      alert("Sale Logged Successfully! Receipt: " + saleRecord.receipt_number);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newProductName.trim();
    const category = newProductCategory;
    const buyingPrice = parseFloat(newProductBuyingPrice);
    const sellingPrice = parseFloat(newProductSellingPrice);
    const stock = parseInt(newProductStock, 10);
    const sku = newProductSku.trim();

    if (!name || isNaN(buyingPrice) || isNaN(sellingPrice) || isNaN(stock)) {
      alert("Please fill in all required fields with valid values.");
      return;
    }

    const api = getElectronAPI();
    if (api && api.addProduct) {
      try {
        await api.addProduct({
          barcode_sku: sku || `SKU-${Date.now()}`,
          name,
          category,
          buying_price: buyingPrice,
          selling_price: sellingPrice,
          stock_count: stock,
        });
        await loadProducts();
      } catch (err: any) {
        alert("Failed to add product: " + (err.message || "Unknown error"));
        return;
      }
    } else {
      const newProduct: Product = {
        id: Date.now(),
        name,
        category,
        buying_price: buyingPrice,
        selling_price: sellingPrice,
        stock_count: stock,
        barcode_sku: sku || `SKU-${Date.now()}`,
      };
      setProducts((prev) => [...prev, newProduct]);
    }

    setNewProductName("");
    setNewProductCategory("Gin");
    setNewProductBuyingPrice("");
    setNewProductSellingPrice("");
    setNewProductStock("");
    setNewProductSku("");
    alert("Product added to inventory!");
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <h1 className="text-2xl font-bold text-center mb-2">
            Liquor Store POS
          </h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            Secure Login Required
          </p>

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

          <div className="mt-6 text-xs text-slate-500 text-center">
            <p>Default Admin: admin / admin123</p>
            <p>Default Cashier: cashier / cashier123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">
              Liquor Store POS
            </h1>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
              {authUser.role === "admin" ? "Administrator" : "Cashier"} |{" "}
              {authUser.username}
            </span>
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
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {timeTampered && timeCheckMessage && (
          <div className="mb-4 p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-300 text-sm">
            <span className="font-semibold">Security Alert:</span>{" "}
            {timeCheckMessage}
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

        {showAdmin && authUser.role === "admin" && (
          <section className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <h2 className="text-lg font-semibold mb-4">Add New Product</h2>
            <form
              onSubmit={handleAdminSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
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
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Gin">Gin</option>
                  <option value="Vodka">Vodka</option>
                  <option value="Rum">Rum</option>
                  <option value="Beer">Beer</option>
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
                  Barcode SKU <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 5555"
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
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or scan SKU barcode..."
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      activeCategory === cat
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {cat}
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
                    <h3 className="font-semibold text-white">
                      {product.name}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      Stock: {product.stock_count}
                    </span>
                    <span className="text-green-400 font-semibold">
                      KSh {product.selling_price.toLocaleString()}
                    </span>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500">
                  No products found.
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col">
              <h2 className="text-lg font-semibold mb-3">Transaction Cart</h2>
              <div className="flex-1 overflow-y-auto max-h-96 space-y-3 pr-1">
                {cart.length === 0 && (
                  <div className="text-center py-10 text-slate-500">
                    Cart is empty.
                  </div>
                )}
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-slate-400">
                        KSh {item.selling_price.toLocaleString()} x{" "}
                        {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <button
                        onClick={() => decrementCartItem(item.id)}
                        className="w-8 h-8 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold transition-colors"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => incrementCartItem(item.id)}
                        className="w-8 h-8 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="ml-4 text-right min-w-[5rem]">
                      <p className="font-semibold text-green-400">
                        KSh{" "}
                        {(
                          item.selling_price * item.quantity
                        ).toLocaleString()}
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
                  <span className="text-xl font-bold text-green-400">
                    KSh {cartTotalAmount.toLocaleString()}
                  </span>
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
              </div>

              {paymentMethod === "mpesa" && (
                <div className="mt-3">
                  <label className="block text-sm text-slate-400 mb-1">
                    Enter M-PESA Reference Code (e.g., TFX987X...)
                  </label>
                  <input
                    type="text"
                    value={mpesaCode}
                    onChange={(e) => {
                      setMpesaCode(e.target.value);
                      setMpesaError(null);
                    }}
                    className={`w-full px-4 py-2 rounded-lg bg-slate-800 border text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                      mpesaError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-700 focus:ring-green-500"
                    }`}
                    placeholder="TFX987X..."
                  />
                  {mpesaError && (
                    <p className="mt-1 text-xs text-red-400">{mpesaError}</p>
                  )}
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
    </div>
  );
}
