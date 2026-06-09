import React, { useEffect, useState } from "react";

interface PaymentSplit {
  cash: number;
  mpesa: number;
}

interface TopProduct {
  name: string;
  total_sold: number;
}

interface AnalyticsData {
  totalRevenue: number;
  totalNetProfit: number;
  paymentSplit: PaymentSplit;
  topMovingProducts: TopProduct[];
}

interface SaleRecord {
  receipt_number: string;
  total_amount: number;
  payment_mode: string;
  created_at: string;
  items: { name: string; quantity: number; price_at_sale: number; buying_price: number }[];
}

function getElectronAPI(): any {
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return null;
}

function getLocalSales(): SaleRecord[] {
  try {
    const raw = localStorage.getItem("pos_sales");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function computeLocalAnalytics(): AnalyticsData {
  const sales = getLocalSales();
  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter((s) => s.created_at.startsWith(today));

  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total_amount, 0);

  let totalNetProfit = 0;
  todaySales.forEach((sale) => {
    sale.items.forEach((item) => {
      totalNetProfit += item.quantity * (item.price_at_sale - item.buying_price);
    });
  });

  const cash = todaySales
    .filter((s) => s.payment_mode === "cash")
    .reduce((sum, s) => sum + s.total_amount, 0);
  const mpesa = todaySales
    .filter((s) => s.payment_mode === "mpesa")
    .reduce((sum, s) => sum + s.total_amount, 0);

  const productMap: Record<string, number> = {};
  todaySales.forEach((sale) => {
    sale.items.forEach((item) => {
      productMap[item.name] = (productMap[item.name] || 0) + item.quantity;
    });
  });

  const topMovingProducts = Object.entries(productMap)
    .map(([name, total_sold]) => ({ name, total_sold }))
    .sort((a, b) => b.total_sold - a.total_sold)
    .slice(0, 3);

  return {
    totalRevenue,
    totalNetProfit,
    paymentSplit: { cash, mpesa },
    topMovingProducts,
  };
}

export default function AdminDashboardView(): JSX.Element {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("");

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const api = getElectronAPI();
      if (api && api.getAdminAnalytics) {
        setMode("electron");
        const data = await api.getAdminAnalytics();
        setAnalytics(data);
      } else {
        setMode("browser");
        const data = computeLocalAnalytics();
        setAnalytics(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalCashFlow =
    (analytics?.paymentSplit.cash || 0) +
    (analytics?.paymentSplit.mpesa || 0);

  const cashPercentage =
    totalCashFlow > 0
      ? Math.round(((analytics?.paymentSplit.cash || 0) / totalCashFlow) * 100)
      : 0;

  const mpesaPercentage =
    totalCashFlow > 0
      ? Math.round(
          ((analytics?.paymentSplit.mpesa || 0) / totalCashFlow) * 100
        )
      : 0;

  const maxTopSold =
    analytics && analytics.topMovingProducts.length > 0
      ? Math.max(...analytics.topMovingProducts.map((p) => p.total_sold))
      : 1;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Executive Analytics</h2>
        <div className="flex items-center gap-3">
          {mode === "browser" && (
            <span className="text-xs px-2 py-1 rounded-md bg-yellow-900/30 border border-yellow-800 text-yellow-300">
              Browser Mode (localStorage)
            </span>
          )}
          {mode === "electron" && (
            <span className="text-xs px-2 py-1 rounded-md bg-green-900/30 border border-green-800 text-green-300">
              Electron Mode (SQLite)
            </span>
          )}
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-slate-400 text-sm">Loading analytics...</div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && !error && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-sm text-slate-400 mb-1">Gross Revenue (Today)</p>
              <p className="text-2xl font-bold text-green-400">
                KSh {analytics.totalRevenue.toLocaleString()}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-sm text-slate-400 mb-1">Net Profit (Today)</p>
              <p className="text-2xl font-bold text-blue-400">
                KSh {analytics.totalNetProfit.toLocaleString()}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-sm text-slate-400 mb-1">Cash Flow Split</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">Cash</span>
                    <span className="text-slate-300">
                      KSh {analytics.paymentSplit.cash.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${cashPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">M-PESA</span>
                    <span className="text-slate-300">
                      KSh {analytics.paymentSplit.mpesa.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${mpesaPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-4">
              Top Moving Products (Today)
            </h3>

            {analytics.topMovingProducts.length === 0 && (
              <p className="text-slate-500 text-sm">
                No sales recorded today.
              </p>
            )}

            {analytics.topMovingProducts.length > 0 && (
              <div className="space-y-4">
                {analytics.topMovingProducts.map((product, index) => {
                  const percentage =
                    maxTopSold > 0
                      ? Math.round((product.total_sold / maxTopSold) * 100)
                      : 0;

                  return (
                    <div key={index} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-bold text-slate-300 border border-slate-700">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {product.name}
                          </span>
                        </div>
                        <span className="text-sm text-slate-400">
                          {product.total_sold} sold
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
