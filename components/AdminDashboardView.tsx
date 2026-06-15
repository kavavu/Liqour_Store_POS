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

interface UserRecord {
  id: number;
  username: string;
  role: string;
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

export default function AdminDashboardView(): React.JSX.Element {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("");

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("cashier");
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserLoading, setAddUserLoading] = useState<boolean>(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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

  async function fetchUsers() {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const api = getElectronAPI();
      if (api && api.getUsers) {
        const rows = await api.getUsers();
        setUsers(rows || []);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      setUsersError(err.message || "Failed to fetch users.");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
    fetchUsers();
  }, []);

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddUserError(null);
    setAddUserLoading(true);

    const username = newUsername.trim();
    const password = newPassword;
    const role = newRole;

    if (!username || !password || !role) {
      setAddUserError("Username, password, and role are required.");
      setAddUserLoading(false);
      return;
    }

    const complexity = passwordComplexity(password);
    if (!complexity.valid) {
      setAddUserError(complexity.message);
      setAddUserLoading(false);
      return;
    }

    const api = getElectronAPI();
    if (api && api.addUser) {
      try {
        const result = await api.addUser({ username, password, role });
        if (result.success) {
          setNewUsername("");
          setNewPassword("");
          setNewRole("cashier");
          await fetchUsers();
        } else {
          setAddUserError(result.message || "Failed to add user.");
        }
      } catch (err: any) {
        setAddUserError(err.message || "Add user error.");
      } finally {
        setAddUserLoading(false);
      }
      return;
    }

    setAddUserError("Electron API not available.");
    setAddUserLoading(false);
  }

  async function handleDeleteUser(userId: number) {
    const api = getElectronAPI();
    if (!api || !api.deleteUser) {
      setUsersError("Delete not available.");
      return;
    }
    try {
      const result = await api.deleteUser({ userId });
      if (result.success) {
        setDeleteConfirmId(null);
        await fetchUsers();
      } else {
        setUsersError(result.message || "Failed to delete user.");
      }
    } catch (err: any) {
      setUsersError(err.message || "Delete user error.");
    }
  }

  const totalCashFlow =
    (analytics?.paymentSplit.cash || 0) + (analytics?.paymentSplit.mpesa || 0);

  const cashPercentage =
    totalCashFlow > 0
      ? Math.round(((analytics?.paymentSplit.cash || 0) / totalCashFlow) * 100)
      : 0;

  const mpesaPercentage =
    totalCashFlow > 0
      ? Math.round(((analytics?.paymentSplit.mpesa || 0) / totalCashFlow) * 100)
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

      {loading && <div className="text-slate-400 text-sm">Loading analytics...</div>}

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
            <h3 className="text-lg font-semibold text-white mb-4">Top Moving Products (Today)</h3>

            {analytics.topMovingProducts.length === 0 && (
              <p className="text-slate-500 text-sm">No sales recorded today.</p>
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
                          <span className="text-sm font-medium text-white">{product.name}</span>
                        </div>
                        <span className="text-sm text-slate-400">{product.total_sold} sold</span>
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

      {/* Staff Manager Portal */}
      <div className="mt-8 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Staff Manager Portal</h3>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Refresh Staff
          </button>
        </div>

        {usersError && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm mb-4">
            {usersError}
          </div>
        )}

        <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. cashier2"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min 8 chars, 1 upper, 1 number, 1 special"
              required
            />
            {newPassword.length > 0 && (
              <p className={`text-xs ${passwordComplexity(newPassword).valid ? "text-green-400" : "text-red-400"}`}>
                {passwordComplexity(newPassword).message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={addUserLoading}
              className="w-full sm:w-auto px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-medium transition-colors"
            >
              {addUserLoading ? "Adding..." : "Add Staff Account"}
            </button>
          </div>
          {addUserError && (
            <div className="sm:col-span-3 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {addUserError}
            </div>
          )}
        </form>

        {usersLoading && <div className="text-slate-400 text-sm">Loading staff...</div>}

        {!usersLoading && users.length === 0 && (
          <p className="text-slate-500 text-sm">No staff accounts found.</p>
        )}

        {!usersLoading && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">ID</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-3">{u.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-md text-xs border ${
                          u.role === "admin"
                            ? "bg-purple-900/30 border-purple-800 text-purple-300"
                            : "bg-blue-900/30 border-blue-800 text-blue-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deleteConfirmId === u.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-300">Confirm delete?</span>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(u.id)}
                          className="px-3 py-1 rounded-md bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function computeLocalAnalytics(): AnalyticsData {
  interface SaleRecord {
    receipt_number: string;
    total_amount: number;
    payment_mode: string;
    created_at: string;
    items: { name: string; quantity: number; price_at_sale: number; buying_price: number }[];
  }

  let sales: SaleRecord[] = [];
  try {
    const raw = localStorage.getItem("pos_sales");
    if (raw) sales = JSON.parse(raw);
  } catch {}

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
    .filter((s) => s.payment_mode === "cash" || s.payment_mode === "split")
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
