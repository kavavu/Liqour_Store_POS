const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: "Liquor Store POS",
    show: false,
  });

  const isDevMode = !app.isPackaged;

  const startUrl = isDevMode
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "out/index.html")}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDevMode) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function initializeDatabase() {
  const dbPath = path.join(app.getPath("userData"), "pos_database.db");
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Failed to open SQLite database:", err.message);
      return;
    }
    console.log("SQLite database opened at:", dbPath);
  });

  db.run("PRAGMA journal_mode=WAL;", (err) => {
    if (err) {
      console.error("Failed to set journal_mode WAL:", err.message);
    } else {
      console.log("PRAGMA journal_mode=WAL applied successfully.");
    }
  });

  db.run("PRAGMA synchronous=NORMAL;", (err) => {
    if (err) {
      console.error("Failed to set synchronous NORMAL:", err.message);
    } else {
      console.log("PRAGMA synchronous=NORMAL applied successfully.");
    }
  });

  db.run("PRAGMA foreign_keys = ON;", (err) => {
    if (err) {
      console.error("Failed to enable foreign keys:", err.message);
    } else {
      console.log("PRAGMA foreign_keys=ON applied successfully.");
    }
  });

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier'
    );
  `;

  const createProductsTable = `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode_sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_count INTEGER NOT NULL DEFAULT 0
    );
  `;

  const createSalesTable = `
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      total_amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      mpesa_code TEXT,
      cashier_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSalesItemsTable = `
    CREATE TABLE IF NOT EXISTS sales_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `;

  const createSystemStateTable = `
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

  const createIndexSku = `
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(barcode_sku);
  `;

  const createIndexName = `
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  `;

  db.serialize(() => {
    db.run(createUsersTable, (err) => {
      if (err) console.error("Error creating users table:", err.message);
    });
    db.run(createProductsTable, (err) => {
      if (err) console.error("Error creating products table:", err.message);
    });
    db.run(createSalesTable, (err) => {
      if (err) console.error("Error creating sales table:", err.message);
    });
    db.run(createSalesItemsTable, (err) => {
      if (err) console.error("Error creating sales_items table:", err.message);
    });
    db.run(createSystemStateTable, (err) => {
      if (err) console.error("Error creating system_state table:", err.message);
    });
    db.run(createIndexSku, (err) => {
      if (err) console.error("Error creating idx_products_sku:", err.message);
    });
    db.run(createIndexName, (err) => {
      if (err) console.error("Error creating idx_products_name:", err.message);
    });
  });

  const seedSystemState = `
    INSERT OR IGNORE INTO system_state (key, value) VALUES ('last_known_time', CURRENT_TIMESTAMP);
  `;
  db.run(seedSystemState, (err) => {
    if (err) console.error("Error seeding system_state:", err.message);
  });

  const seedProducts = [
    { sku: "1111", name: "Chrome Vodka 250ml", category: "Vodka", buying: 240, selling: 300, stock: 15 },
    { sku: "2222", name: "Gilbeys Gin 750ml", category: "Gin", buying: 1150, selling: 1400, stock: 8 },
    { sku: "3333", name: "Captain Morgan 750ml", category: "Rum", buying: 1300, selling: 1600, stock: 5 },
    { sku: "4444", name: "White Cap Lager", category: "Beer", buying: 240, selling: 300, stock: 24 },
  ];

  seedProducts.forEach((p) => {
    const stmt = `
      INSERT OR IGNORE INTO products (barcode_sku, name, category, buying_price, selling_price, stock_count)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    db.run(stmt, [p.sku, p.name, p.category, p.buying, p.selling, p.stock], (err) => {
      if (err) console.error("Error seeding product:", err.message);
    });
  });

  const adminPasswordHash = crypto.createHash("sha256").update("admin123").digest("hex");
  const cashierPasswordHash = crypto.createHash("sha256").update("cashier123").digest("hex");

  const seedAdmin = `
    INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?);
  `;
  db.run(seedAdmin, ["admin", adminPasswordHash, "admin"], (err) => {
    if (err) console.error("Error seeding admin user:", err.message);
  });

  const seedCashier = `
    INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?);
  `;
  db.run(seedCashier, ["cashier", cashierPasswordHash, "cashier"], (err) => {
    if (err) console.error("Error seeding cashier user:", err.message);
  });
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error("Error closing database:", err.message);
      } else {
        console.log("Database connection closed gracefully.");
      }
    });
  }
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  closeDatabase();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  closeDatabase();
});

ipcMain.handle("get-products", async () => {
  return new Promise((resolve, reject) => {
    try {
      const query = `SELECT * FROM products ORDER BY name ASC;`;
      db.all(query, [], (err, rows) => {
        if (err) {
          console.error("get-products error:", err.message);
          reject(err);
          return;
        }
        resolve(rows);
      });
    } catch (error) {
      console.error("get-products exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("add-product", async (event, product) => {
  return new Promise((resolve, reject) => {
    try {
      const {
        barcode_sku,
        name,
        category,
        buying_price,
        selling_price,
        stock_count,
      } = product;

      const stmt = `
        INSERT INTO products (barcode_sku, name, category, buying_price, selling_price, stock_count)
        VALUES (?, ?, ?, ?, ?, ?);
      `;

      db.run(
        stmt,
        [barcode_sku, name, category, buying_price, selling_price, stock_count],
        function (err) {
          if (err) {
            console.error("add-product error:", err.message);
            reject(err);
            return;
          }
          resolve({ success: true, id: this.lastID });
        }
      );
    } catch (error) {
      console.error("add-product exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("log-sale", async (event, payload) => {
  return new Promise((resolve, reject) => {
    try {
      const { cartItems, paymentDetails } = payload;
      const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { totalAmount, paymentMode, mpesaCode, cashierId } = paymentDetails;

      db.run("BEGIN TRANSACTION;", (beginErr) => {
        if (beginErr) {
          console.error("log-sale BEGIN error:", beginErr.message);
          reject(beginErr);
          return;
        }

        const saleStmt = `
          INSERT INTO sales (receipt_number, total_amount, payment_mode, mpesa_code, cashier_id)
          VALUES (?, ?, ?, ?, ?);
        `;

        db.run(
          saleStmt,
          [receiptNumber, totalAmount, paymentMode, mpesaCode || null, cashierId || null],
          function (saleErr) {
            if (saleErr) {
              console.error("log-sale insert sales error:", saleErr.message);
              db.run("ROLLBACK;", () => {
                reject(saleErr);
              });
              return;
            }

            const saleId = this.lastID;
            let completedItems = 0;
            let itemError = null;

            if (cartItems.length === 0) {
              db.run("COMMIT;", (commitErr) => {
                if (commitErr) {
                  console.error("log-sale COMMIT error:", commitErr.message);
                  db.run("ROLLBACK;", () => {
                    reject(commitErr);
                  });
                  return;
                }
                resolve({ success: true, receiptNumber, saleId });
              });
              return;
            }

            cartItems.forEach((item) => {
              if (itemError) return;

              const itemStmt = `
                INSERT INTO sales_items (sale_id, product_id, quantity, price_at_sale)
                VALUES (?, ?, ?, ?);
              `;

              db.run(
                itemStmt,
                [saleId, item.productId, item.quantity, item.priceAtSale],
                (itemErr) => {
                  if (itemError) return;

                  if (itemErr) {
                    itemError = itemErr;
                    console.error("log-sale insert sales_items error:", itemErr.message);
                    db.run("ROLLBACK;", () => {
                      reject(itemErr);
                    });
                    return;
                  }

                  const updateStockStmt = `
                    UPDATE products SET stock_count = stock_count - ? WHERE id = ?;
                  `;

                  db.run(updateStockStmt, [item.quantity, item.productId], (updateErr) => {
                    if (itemError) return;

                    if (updateErr) {
                      itemError = updateErr;
                      console.error("log-sale update stock error:", updateErr.message);
                      db.run("ROLLBACK;", () => {
                        reject(updateErr);
                      });
                      return;
                    }

                    completedItems += 1;

                    if (completedItems === cartItems.length) {
                      db.run("COMMIT;", (commitErr) => {
                        if (commitErr) {
                          console.error("log-sale COMMIT error:", commitErr.message);
                          db.run("ROLLBACK;", () => {
                            reject(commitErr);
                          });
                          return;
                        }
                        resolve({ success: true, receiptNumber, saleId });
                      });
                    }
                  });
                }
              );
            });
          }
        );
      });
    } catch (error) {
      console.error("log-sale exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("get-admin-analytics", async () => {
  return new Promise((resolve, reject) => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const totalRevenueQuery = `
        SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
        FROM sales
        WHERE DATE(created_at) = ?;
      `;

      const netProfitQuery = `
        SELECT COALESCE(SUM(si.quantity * (si.price_at_sale - p.buying_price)), 0) AS total_net_profit
        FROM sales_items si
        INNER JOIN products p ON si.product_id = p.id
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) = ?;
      `;

      const paymentSplitQuery = `
        SELECT payment_mode, COALESCE(SUM(total_amount), 0) AS total
        FROM sales
        WHERE DATE(created_at) = ?
        GROUP BY payment_mode;
      `;

      const topMovingProductsQuery = `
        SELECT p.name, SUM(si.quantity) AS total_sold
        FROM sales_items si
        INNER JOIN products p ON si.product_id = p.id
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) = ?
        GROUP BY si.product_id
        ORDER BY total_sold DESC
        LIMIT 3;
      `;

      db.get(totalRevenueQuery, [today], (err1, revenueRow) => {
        if (err1) {
          console.error("get-admin-analytics revenue error:", err1.message);
          reject(err1);
          return;
        }

        db.get(netProfitQuery, [today], (err2, profitRow) => {
          if (err2) {
            console.error("get-admin-analytics profit error:", err2.message);
            reject(err2);
            return;
          }

          db.all(paymentSplitQuery, [today], (err3, paymentRows) => {
            if (err3) {
              console.error("get-admin-analytics payment split error:", err3.message);
              reject(err3);
              return;
            }

            db.all(topMovingProductsQuery, [today], (err4, topProductsRows) => {
              if (err4) {
                console.error("get-admin-analytics top products error:", err4.message);
                reject(err4);
                return;
              }

              const cashTotal =
                paymentRows.find((r) => r.payment_mode === "cash")?.total || 0;
              const mpesaTotal =
                paymentRows.find((r) => r.payment_mode === "mpesa")?.total || 0;

              resolve({
                totalRevenue: revenueRow.total_revenue || 0,
                totalNetProfit: profitRow.total_net_profit || 0,
                paymentSplit: {
                  cash: cashTotal,
                  mpesa: mpesaTotal,
                },
                topMovingProducts: topProductsRows || [],
              });
            });
          });
        });
      });
    } catch (error) {
      console.error("get-admin-analytics exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("authenticate-user", async (event, credentials) => {
  return new Promise((resolve, reject) => {
    try {
      const { username, password } = credentials;
      if (!username || !password) {
        resolve({ success: false, message: "Username and password are required." });
        return;
      }

      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
      const query = `SELECT id, username, role FROM users WHERE username = ? AND password_hash = ?;`;

      db.get(query, [username, passwordHash], (err, row) => {
        if (err) {
          console.error("authenticate-user error:", err.message);
          reject(err);
          return;
        }

        if (row) {
          resolve({ success: true, user: { id: row.id, username: row.username, role: row.role } });
        } else {
          resolve({ success: false, message: "Invalid username or password." });
        }
      });
    } catch (error) {
      console.error("authenticate-user exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("validate-system-time", async () => {
  return new Promise((resolve, reject) => {
    try {
      const currentTime = new Date().toISOString();

      const selectQuery = `SELECT value FROM system_state WHERE key = 'last_known_time';`;
      db.get(selectQuery, [], (err, row) => {
        if (err) {
          console.error("validate-system-time select error:", err.message);
          reject(err);
          return;
        }

        if (!row) {
          const insertQuery = `
            INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_known_time', ?);
          `;
          db.run(insertQuery, [currentTime], (insertErr) => {
            if (insertErr) {
              console.error("validate-system-time insert error:", insertErr.message);
              reject(insertErr);
              return;
            }
            resolve({ valid: true, tampered: false, currentTime });
          });
          return;
        }

        const lastKnownTime = new Date(row.value);
        const now = new Date(currentTime);

        if (now < lastKnownTime) {
          resolve({
            valid: false,
            tampered: true,
            message: "System clock appears to have been rolled back. Last known time: " + row.value,
            currentTime,
            lastKnownTime: row.value,
          });
          return;
        }

        const updateQuery = `
          UPDATE system_state SET value = ? WHERE key = 'last_known_time';
        `;
        db.run(updateQuery, [currentTime], (updateErr) => {
          if (updateErr) {
            console.error("validate-system-time update error:", updateErr.message);
            reject(updateErr);
            return;
          }
          resolve({ valid: true, tampered: false, currentTime });
        });
      });
    } catch (error) {
      console.error("validate-system-time exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("global-barcode-scan", async (event, barcode) => {
  return new Promise((resolve, reject) => {
    try {
      if (!barcode || typeof barcode !== "string") {
        resolve({ found: false, message: "Invalid barcode input." });
        return;
      }

      const trimmedBarcode = barcode.trim();
      if (trimmedBarcode.length === 0) {
        resolve({ found: false, message: "Empty barcode input." });
        return;
      }

      const query = `SELECT * FROM products WHERE barcode_sku = ? LIMIT 1;`;
      db.get(query, [trimmedBarcode], (err, row) => {
        if (err) {
          console.error("global-barcode-scan error:", err.message);
          reject(err);
          return;
        }

        if (row) {
          resolve({ found: true, product: row });
        } else {
          resolve({ found: false, message: "Product not found for barcode: " + trimmedBarcode });
        }
      });
    } catch (error) {
      console.error("global-barcode-scan exception:", error);
      reject(error);
    }
  });
});

ipcMain.handle("validate-mpesa-code", async (event, code) => {
  return new Promise((resolve) => {
    try {
      if (!code || typeof code !== "string") {
        resolve({ valid: false, message: "M-PESA code is required." });
        return;
      }

      const trimmedCode = code.trim().toUpperCase();
      if (trimmedCode.length === 0) {
        resolve({ valid: false, message: "M-PESA code cannot be empty." });
        return;
      }

      const mpesaRegex = /^[A-Z0-9]{6,12}$/;
      if (!mpesaRegex.test(trimmedCode)) {
        resolve({
          valid: false,
          message: "Invalid M-PESA code format. Must be 6-12 alphanumeric characters (e.g., TFX987X).",
        });
        return;
      }

      resolve({ valid: true, sanitizedCode: trimmedCode });
    } catch (error) {
      console.error("validate-mpesa-code exception:", error);
      resolve({ valid: false, message: "Validation error occurred." });
    }
  });
});
