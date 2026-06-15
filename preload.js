const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getProducts: () => ipcRenderer.invoke("get-products"),
  addProduct: (product) => ipcRenderer.invoke("add-product", product),
  logSale: (cartItems, paymentDetails) =>
    ipcRenderer.invoke("log-sale", { cartItems, paymentDetails }),
  getAdminAnalytics: () => ipcRenderer.invoke("get-admin-analytics"),
  authenticateUser: (credentials) =>
    ipcRenderer.invoke("authenticate-user", credentials),
  validateSystemTime: () => ipcRenderer.invoke("validate-system-time"),
  globalBarcodeScan: (barcode) =>
    ipcRenderer.invoke("global-barcode-scan", barcode),
  validateMpesaCode: (code) =>
    ipcRenderer.invoke("validate-mpesa-code", code),
  checkInitialSetup: () => ipcRenderer.invoke("auth:check-initial-setup"),
  registerMasterAdmin: (payload) => ipcRenderer.invoke("auth:register-master-admin", payload),
  login: (payload) => ipcRenderer.invoke("auth:login", payload),
  openShift: (payload) => ipcRenderer.invoke("shift:open", payload),
  getOpenShift: (payload) => ipcRenderer.invoke("shift:get-open", payload),
  closeShiftReconcile: (payload) => ipcRenderer.invoke("shift:close-reconcile", payload),
  getCategories: () => ipcRenderer.invoke("get-categories"),
  getUsers: () => ipcRenderer.invoke("get-users"),
  addUser: (payload) => ipcRenderer.invoke("add-user", payload),
  deleteUser: (payload) => ipcRenderer.invoke("delete-user", payload),
  runQATests: () => ipcRenderer.invoke("qa:run-tests"),
  onBackendError: (callback) => ipcRenderer.on("backend-error", (_event, message) => callback(message)),
});
