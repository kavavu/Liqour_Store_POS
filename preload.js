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
});
