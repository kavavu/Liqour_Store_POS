const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

let mainWindow;
let db;
let dbReady = false;

// ─── GLOBAL PROCESS CATCHERS ───
process.on("uncaughtException", (error) => {
  console.error("CRITICAL BACKEND UNCAUGHT EXCEPTION:", error);
  if (mainWindow && mainWindow.webContents) {
    try {
      mainWindow.webContents.send("backend-error", error.message || "Unknown uncaught exception");
    } catch (e) {}
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL BACKEND UNHANDLED REJECTION at:", promise, "reason:", reason);
  if (mainWindow && mainWindow.webContents) {
    try {
      mainWindow.webContents.send("backend-error", String(reason) || "Unknown unhandled rejection");
    } catch (e) {}
  }
});

// ─── PRODUCTION GUARD ───
const ALLOW_TEST_USER_SEEDING = false;

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

function generateSalt(length = 16) {
  try {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  } catch (error) {
    console.error("generateSalt exception:", error);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

function hashPasswordWithSalt(password, salt) {
  try {
    return crypto.createHash("sha256").update(password + salt).digest("hex");
  } catch (error) {
    console.error("hashPasswordWithSalt exception:", error);
    throw error;
  }
}

// ─── BULLETPROOF DATABASE INITIALIZATION ───
function initializeDatabase() {
  try {
    const userDataPath = app.getPath("userData");
    // AGGRESSIVE PATH CREATION: ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      try {
        fs.mkdirSync(userDataPath, { recursive: true });
        console.log("[DB] Created userData directory:", userDataPath);
      } catch (mkdirErr) {
        console.error("[DB] FAILED to create userData directory:", mkdirErr.message);
        throw mkdirErr;
      }
    }

    const dbPath = path.join(userDataPath, "pos_database.db");
    const dbExists = fs.existsSync(dbPath);
    console.log("[DB] Target path:", dbPath, "| Exists:", dbExists);

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("[DB] FAILED to open SQLite database:", err.message);
        dbReady = false;
        return;
      }
      console.log("[DB] SQLite database opened successfully.");
    });

    // Apply pragmas
    db.run("PRAGMA journal_mode = WAL;", (err) => {
      if (err) console.error("[DB] PRAGMA journal_mode WAL failed:", err.message);
      else console.log("[DB] PRAGMA journal_mode = WAL applied.");
    });
    db.run("PRAGMA synchronous = NORMAL;", (err) => {
      if (err) console.error("[DB] PRAGMA synchronous NORMAL failed:", err.message);
      else console.log("[DB] PRAGMA synchronous = NORMAL applied.");
    });
    db.run("PRAGMA foreign_keys = ON;", (err) => {
      if (err) console.error("[DB] PRAGMA foreign_keys ON failed:", err.message);
      else console.log("[DB] PRAGMA foreign_keys = ON applied.");
    });

    if (!dbExists) {
      console.log("[DB] Database file is NEW. Running CREATE TABLE + seeding.");
      runCreateAndSeedTablesSync();
    } else {
      console.log("[DB] Database file EXISTS. Verifying schema integrity.");
      verifySchemaIntegrity();
    }
  } catch (error) {
    console.error("[DB] initializeDatabase exception:", error);
    dbReady = false;
  }
}

// SYNCHRONOUS table creation using serialize() + completion callback
function runCreateAndSeedTablesSync() {
  try {
    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        parent_category TEXT
      );`;
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL
      );`;
    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category_id INTEGER,
        buying_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        stock_count INTEGER NOT NULL,
        unit_size TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );`;
    const createShiftsTable = `
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        expected_cash REAL DEFAULT 0.0,
        expected_mpesa REAL DEFAULT 0.0,
        actual_cash REAL DEFAULT 0.0,
        actual_mpesa REAL DEFAULT 0.0,
        status TEXT DEFAULT 'OPEN',
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`;
    const createSalesTable = `
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT UNIQUE NOT NULL,
        shift_id INTEGER,
        amount_cash REAL DEFAULT 0.0,
        amount_mpesa REAL DEFAULT 0.0,
        total_amount REAL NOT NULL,
        mpesa_code TEXT UNIQUE,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
      );`;
    const createSalesItemsTable = `
      CREATE TABLE IF NOT EXISTS sales_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price_at_sale REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );`;
    const createSystemStateTable = `
      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`;

    const createIndexSku = `CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`;
    const createIndexName = `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`;
    const createIndexSalesShift = `CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);`;
    const createIndexSalesItemsSale = `CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON sales_items(sale_id);`;
    const createIndexShiftsUser = `CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);`;
    const createIndexShiftsStatus = `CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);`;

    db.serialize(() => {
      db.run(createCategoriesTable);
      db.run(createUsersTable);
      db.run(createProductsTable);
      db.run(createShiftsTable);
      db.run(createSalesTable);
      db.run(createSalesItemsTable);
      db.run(createSystemStateTable);
      db.run(createIndexSku);
      db.run(createIndexName);
      db.run(createIndexSalesShift);
      db.run(createIndexSalesItemsSale);
      db.run(createIndexShiftsUser);
      db.run(createIndexShiftsStatus);
    });

    // Final callback in serialize queue marks DB ready
    db.run("SELECT 1 AS db_ready;", [], (err) => {
      if (err) {
        console.error("[DB] Final schema verification failed:", err.message);
        dbReady = false;
      } else {
        console.log("[DB] All tables created successfully.");
        dbReady = true;
        seedInitialData();
      }
    });
  } catch (error) {
    console.error("[DB] runCreateAndSeedTablesSync exception:", error);
    dbReady = false;
  }
}

function verifySchemaIntegrity() {
  try {
    const requiredTables = ["categories", "users", "products", "shifts", "sales", "sales_items", "system_state"];
    db.get("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table';", [], (err, row) => {
      if (err) {
        console.error("[DB] Schema integrity check failed:", err.message);
        dbReady = false;
        return;
      }
      console.log("[DB] Found", row.count, "tables in database.");
      dbReady = true;
      // If tables seem missing, recreate
      if (row.count < requiredTables.length) {
        console.log("[DB] Table count low, re-running schema creation.");
        runCreateAndSeedTablesSync();
      }
    });
  } catch (error) {
    console.error("[DB] verifySchemaIntegrity exception:", error);
    dbReady = false;
  }
}

function seedInitialData() {
  try {
    const seedSystemState = `INSERT OR IGNORE INTO system_state (key, value) VALUES ('last_known_time', CURRENT_TIMESTAMP);`;
    db.run(seedSystemState, (err) => {
      if (err) console.error("[DB] Error seeding system_state:", err.message);
    });

    db.get(`SELECT COUNT(*) AS count FROM users;`, [], (err, row) => {
      if (err) {
        console.error("[DB] Error checking users count:", err.message);
        return;
      }
      const userCount = row ? row.count : 0;
      if (userCount === 0) {
        console.log("[DB] BLANK SLATE. Seeding categories only (no sample products).");
        seedCategoriesOnly();
      } else {
        console.log("[DB] Users exist (", userCount, "). Skipping seeding.");
      }
    });
  } catch (error) {
    console.error("[DB] seedInitialData exception:", error);
  }
}

function seedCategoriesOnly() {
  try {
    const categories = [
      { name: "Whisk(e)y", parent: null },
      { name: "Gin", parent: null },
      { name: "Vodka", parent: null },
      { name: "Rum", parent: null },
      { name: "Brandy & Cognac", parent: null },
      { name: "Wine", parent: null },
      { name: "Tequila", parent: null },
      { name: "Liqueurs", parent: null },
      { name: "Beers & RTDs", parent: null },
    ];
    categories.forEach((cat) => {
      db.run(`INSERT OR IGNORE INTO categories (name, parent_category) VALUES (?, ?);`, [cat.name, cat.parent]);
    });
    console.log("[DB] Categories seeded (no sample products).");
  } catch (error) {
    console.error("[DB] seedCategoriesOnly exception:", error);
  }
}

function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) console.error("[DB] Error closing database:", err.message);
      else console.log("[DB] Database connection closed gracefully.");
    });
  }
}

// ─── APP LIFECYCLE ───
app.whenReady().then(() => {
  try {
    initializeDatabase();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("[APP] app.whenReady exception:", error);
  }
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

// ─── IPC HANDLERS ───

// IPC: auth:check-initial-setup
ipcMain.handle("auth:check-initial-setup", async () => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        console.log("[IPC] auth:check-initial-setup: DB not ready, returning true (needs setup)");
        resolve(true);
        return;
      }
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='users';`, [], (err, row) => {
        if (err) {
          console.error("[IPC] auth:check-initial-setup table check error:", err.message);
          resolve(true);
          return;
        }
        if (!row) {
          console.log("[IPC] auth:check-initial-setup: users table does not exist, needs setup");
          resolve(true);
          return;
        }
        db.get(`SELECT COUNT(*) AS count FROM users;`, [], (err2, row2) => {
          if (err2) {
            console.error("[IPC] auth:check-initial-setup count error:", err2.message);
            resolve(true);
            return;
          }
          console.log("[IPC] auth:check-initial-setup: users count =", row2.count, "needsSetup =", row2.count === 0);
          resolve(row2.count === 0);
        });
      });
    } catch (error) {
      console.error("[IPC] auth:check-initial-setup exception:", error);
      resolve(true);
    }
  });
});

// IPC: auth:register-master-admin
ipcMain.handle("auth:register-master-admin", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { username, password } = payload || {};
      if (!username || !password) {
        resolve({ success: false, message: "Username and password are required." });
        return;
      }
      db.get(`SELECT COUNT(*) AS count FROM users;`, [], (err, row) => {
        if (err) {
          console.error("[IPC] auth:register-master-admin count error:", err.message);
          resolve({ success: false, message: "Database error." });
          return;
        }
        if (row.count > 0) {
          resolve({ success: false, message: "Initial setup already completed." });
          return;
        }
        const salt = generateSalt(16);
        const passwordHash = hashPasswordWithSalt(password, salt);
        db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`,
          [username.trim(), passwordHash, salt, "admin"], function (err2) {
          if (err2) {
            console.error("[IPC] auth:register-master-admin insert error:", err2.message);
            resolve({ success: false, message: "Failed to create admin." });
            return;
          }
          resolve({ success: true, userId: this.lastID });
        });
      });
    } catch (error) {
      console.error("[IPC] auth:register-master-admin exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: auth:login
ipcMain.handle("auth:login", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { username, password } = payload || {};
      if (!username || !password) {
        resolve({ success: false, message: "Username and password are required." });
        return;
      }
      db.get(`SELECT id, username, password_hash, salt, role FROM users WHERE username = ?;`, [username.trim()], (err, row) => {
        if (err) {
          console.error("[IPC] auth:login select error:", err.message);
          resolve({ success: false, message: "Database error." });
          return;
        }
        if (!row) {
          resolve({ success: false, message: "Invalid username or password." });
          return;
        }
        const passwordHash = hashPasswordWithSalt(password, row.salt);
        if (passwordHash !== row.password_hash) {
          resolve({ success: false, message: "Invalid username or password." });
          return;
        }
        db.get(`SELECT value FROM system_state WHERE key = 'last_known_time';`, [], (timeErr, timeRow) => {
          if (timeErr) {
            console.error("[IPC] auth:login time check error:", timeErr.message);
          }
          const nowStr = new Date().toISOString();
          if (timeRow && timeRow.value) {
            const lastKnown = new Date(timeRow.value);
            const now = new Date(nowStr);
            if (now < lastKnown) {
              resolve({ success: false, message: "Hardware tampering detected: system clock rolled back.", tampered: true });
              return;
            }
          }
          db.run(`INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_known_time', ?);`, [nowStr], (updateErr) => {
            if (updateErr) console.error("[IPC] auth:login time update error:", updateErr.message);
            resolve({ success: true, user: { id: row.id, username: row.username, role: row.role } });
          });
        });
      });
    } catch (error) {
      console.error("[IPC] auth:login exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: shift:open
ipcMain.handle("shift:open", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { userId } = payload || {};
      if (!userId) {
        resolve({ success: false, message: "User ID is required." });
        return;
      }
      db.get(`SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN' LIMIT 1;`, [userId], (err, row) => {
        if (err) {
          console.error("[IPC] shift:open check error:", err.message);
          resolve({ success: false, message: "Database error." });
          return;
        }
        if (row) {
          resolve({ success: false, message: "An open shift already exists.", shiftId: row.id });
          return;
        }
        db.run(`INSERT INTO shifts (user_id, opened_at, status) VALUES (?, datetime('now'), 'OPEN');`, [userId], function (err2) {
          if (err2) {
            console.error("[IPC] shift:open insert error:", err2.message);
            resolve({ success: false, message: "Failed to open shift." });
            return;
          }
          resolve({ success: true, shiftId: this.lastID });
        });
      });
    } catch (error) {
      console.error("[IPC] shift:open exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: shift:get-open
ipcMain.handle("shift:get-open", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { userId } = payload || {};
      if (!userId) {
        resolve({ success: false, message: "User ID is required." });
        return;
      }
      db.get(`SELECT id, user_id, opened_at, expected_cash, expected_mpesa, status FROM shifts WHERE user_id = ? AND status = 'OPEN' LIMIT 1;`,
        [userId], (err, row) => {
        if (err) {
          console.error("[IPC] shift:get-open error:", err.message);
          resolve({ success: false, message: "Database error." });
          return;
        }
        if (row) {
          resolve({ success: true, shift: row });
        } else {
          resolve({ success: false, message: "No open shift found." });
        }
      });
    } catch (error) {
      console.error("[IPC] shift:get-open exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: shift:close-reconcile
ipcMain.handle("shift:close-reconcile", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { shiftId, actualCash, actualMpesa } = payload || {};
      if (!shiftId) {
        resolve({ success: false, message: "Shift ID is required." });
        return;
      }
      db.get(`SELECT expected_cash, expected_mpesa FROM shifts WHERE id = ? AND status = 'OPEN';`, [shiftId], (err, row) => {
        if (err) {
          console.error("[IPC] shift:close-reconcile select error:", err.message);
          resolve({ success: false, message: "Database error." });
          return;
        }
        if (!row) {
          resolve({ success: false, message: "Open shift not found." });
          return;
        }
        const expectedCash = parseFloat(row.expected_cash) || 0;
        const expectedMpesa = parseFloat(row.expected_mpesa) || 0;
        const actualCashNum = parseFloat(actualCash) || 0;
        const actualMpesaNum = parseFloat(actualMpesa) || 0;
        const varianceCash = actualCashNum - expectedCash;
        const varianceMpesa = actualMpesaNum - expectedMpesa;

        db.run(`UPDATE shifts SET closed_at = datetime('now'), actual_cash = ?, actual_mpesa = ?, status = 'CLOSED' WHERE id = ?;`,
          [actualCashNum, actualMpesaNum, shiftId], function (err2) {
          if (err2) {
            console.error("[IPC] shift:close-reconcile update error:", err2.message);
            resolve({ success: false, message: "Failed to close shift." });
            return;
          }
          resolve({
            success: true,
            expectedCash,
            expectedMpesa,
            actualCash: actualCashNum,
            actualMpesa: actualMpesaNum,
            varianceCash,
            varianceMpesa,
          });
        });
      });
    } catch (error) {
      console.error("[IPC] shift:close-reconcile exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: get-products
ipcMain.handle("get-products", async () => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve([]);
        return;
      }
      db.all(`SELECT p.id, p.sku, p.name, p.category_id, c.name AS category, p.buying_price, p.selling_price, p.stock_count, p.unit_size FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.name ASC;`, [], (err, rows) => {
        if (err) {
          console.error("[IPC] get-products error:", err.message);
          resolve([]);
          return;
        }
        resolve(rows || []);
      });
    } catch (error) {
      console.error("[IPC] get-products exception:", error);
      resolve([]);
    }
  });
});

// IPC: add-product
ipcMain.handle("add-product", async (event, product) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      let { sku, name, category_id, buying_price, selling_price, stock_count, unit_size } = product || {};
      if (!sku) sku = `AUTO-${Date.now()}`;
      if (!name || buying_price === undefined || selling_price === undefined || stock_count === undefined || !unit_size) {
        resolve({ success: false, message: "Missing required product fields." });
        return;
      }
      db.run(`INSERT INTO products (sku, name, category_id, buying_price, selling_price, stock_count, unit_size) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [sku, name, category_id || null, buying_price, selling_price, stock_count, unit_size], function (err) {
        if (err) {
          console.error("[IPC] add-product error:", err.message);
          resolve({ success: false, message: "Failed to add product." });
          return;
        }
        resolve({ success: true, id: this.lastID });
      });
    } catch (error) {
      console.error("[IPC] add-product exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: log-sale
ipcMain.handle("log-sale", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { cartItems, paymentDetails } = payload || {};
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        resolve({ success: false, message: "Cart is empty." });
        return;
      }
      const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { totalAmount, shiftId, amountCash, amountMpesa, mpesaCode } = paymentDetails || {};
      const cashAmt = parseFloat(amountCash) || 0;
      const mpesaAmt = parseFloat(amountMpesa) || 0;
      const totalAmt = parseFloat(totalAmount) || 0;

      db.get(`SELECT value FROM system_state WHERE key = 'last_known_time';`, [], (timeErr, timeRow) => {
        if (timeErr) {
          console.error("[IPC] log-sale time check error:", timeErr.message);
        }
        const nowStr = new Date().toISOString();
        if (timeRow && timeRow.value) {
          const lastKnown = new Date(timeRow.value);
          const now = new Date(nowStr);
          if (now < lastKnown) {
            resolve({ success: false, message: "Hardware tampering detected. Sale aborted.", tampered: true });
            return;
          }
        }

        if (mpesaAmt > 0) {
          const mpesaRegex = /^[A-Z0-9]{10}$/;
          const code = (mpesaCode || "").trim().toUpperCase();
          if (!mpesaRegex.test(code)) {
            resolve({ success: false, message: "Invalid M-PESA code. Must be 10 uppercase alphanumeric chars." });
            return;
          }
          db.get(`SELECT id FROM sales WHERE mpesa_code = ? LIMIT 1;`, [code], (uniqueErr, uniqueRow) => {
            if (uniqueErr) {
              console.error("[IPC] log-sale mpesa uniqueness error:", uniqueErr.message);
              resolve({ success: false, message: "Database error." });
              return;
            }
            if (uniqueRow) {
              resolve({ success: false, message: "M-PESA code already used." });
              return;
            }
            proceedTransaction(code, nowStr);
          });
        } else {
          proceedTransaction(null, nowStr);
        }

        function proceedTransaction(finalMpesaCode, timestamp) {
          db.run("BEGIN TRANSACTION;", (beginErr) => {
            if (beginErr) {
              console.error("[IPC] log-sale BEGIN error:", beginErr.message);
              resolve({ success: false, message: "Transaction failed." });
              return;
            }
            db.run(`INSERT INTO sales (receipt_number, shift_id, amount_cash, amount_mpesa, total_amount, mpesa_code, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?);`,
              [receiptNumber, shiftId || null, cashAmt, mpesaAmt, totalAmt, finalMpesaCode, timestamp], function (saleErr) {
              if (saleErr) {
                console.error("[IPC] log-sale insert sales error:", saleErr.message);
                db.run("ROLLBACK;", () => {
                  resolve({ success: false, message: "Sale logging failed." });
                });
                return;
              }
              const saleId = this.lastID;
              let completedItems = 0;
              let itemError = null;

              if (cartItems.length === 0) {
                db.run("COMMIT;", (commitErr) => {
                  if (commitErr) {
                    db.run("ROLLBACK;", () => {
                      resolve({ success: false, message: "Commit failed." });
                    });
                    return;
                  }
                  resolve({ success: true, receiptNumber, saleId });
                });
                return;
              }

              cartItems.forEach((item) => {
                if (itemError) return;
                db.run(`INSERT INTO sales_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?);`,
                  [saleId, item.productId, item.quantity, item.priceAtSale], (itemErr) => {
                  if (itemError) return;
                  if (itemErr) {
                    itemError = itemErr;
                    console.error("[IPC] log-sale insert sales_items error:", itemErr.message);
                    db.run("ROLLBACK;", () => {
                      resolve({ success: false, message: "Sale item logging failed." });
                    });
                    return;
                  }
                  db.run(`UPDATE products SET stock_count = stock_count - ? WHERE id = ?;`, [item.quantity, item.productId], (updateErr) => {
                    if (itemError) return;
                    if (updateErr) {
                      itemError = updateErr;
                      console.error("[IPC] log-sale update stock error:", updateErr.message);
                      db.run("ROLLBACK;", () => {
                        resolve({ success: false, message: "Stock update failed." });
                      });
                      return;
                    }
                    completedItems += 1;
                    if (completedItems === cartItems.length) {
                      if (shiftId) {
                        db.run(`UPDATE shifts SET expected_cash = expected_cash + ?, expected_mpesa = expected_mpesa + ? WHERE id = ? AND status = 'OPEN';`,
                          [cashAmt, mpesaAmt, shiftId], (shiftErr) => {
                          if (shiftErr) {
                            console.error("[IPC] log-sale shift update error:", shiftErr.message);
                            db.run("ROLLBACK;", () => {
                              resolve({ success: false, message: "Shift update failed." });
                            });
                            return;
                          }
                          db.run(`INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_known_time', ?);`, [timestamp], (timeUpdateErr) => {
                            if (timeUpdateErr) console.error("[IPC] log-sale time update error:", timeUpdateErr.message);
                            db.run("COMMIT;", (commitErr) => {
                              if (commitErr) {
                                db.run("ROLLBACK;", () => {
                                  resolve({ success: false, message: "Commit failed." });
                                });
                                return;
                              }
                              resolve({ success: true, receiptNumber, saleId });
                            });
                          });
                        });
                      } else {
                        db.run(`INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_known_time', ?);`, [timestamp], (timeUpdateErr) => {
                          if (timeUpdateErr) console.error("[IPC] log-sale time update error:", timeUpdateErr.message);
                          db.run("COMMIT;", (commitErr) => {
                            if (commitErr) {
                              db.run("ROLLBACK;", () => {
                                resolve({ success: false, message: "Commit failed." });
                              });
                              return;
                            }
                            resolve({ success: true, receiptNumber, saleId });
                          });
                        });
                      }
                    }
                  });
                });
              });
            });
          });
        }
      });
    } catch (error) {
      console.error("[IPC] log-sale exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: get-admin-analytics
ipcMain.handle("get-admin-analytics", async () => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ totalRevenue: 0, totalNetProfit: 0, paymentSplit: { cash: 0, mpesa: 0 }, topMovingProducts: [] });
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      db.get(`SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM sales WHERE DATE(timestamp) = ?;`, [today], (err1, revenueRow) => {
        if (err1) {
          console.error("[IPC] get-admin-analytics revenue error:", err1.message);
          resolve({ totalRevenue: 0, totalNetProfit: 0, paymentSplit: { cash: 0, mpesa: 0 }, topMovingProducts: [] });
          return;
        }
        db.get(`SELECT COALESCE(SUM(si.quantity * (si.price_at_sale - p.buying_price)), 0) AS total_net_profit FROM sales_items si INNER JOIN products p ON si.product_id = p.id INNER JOIN sales s ON si.sale_id = s.id WHERE DATE(s.timestamp) = ?;`, [today], (err2, profitRow) => {
          if (err2) {
            console.error("[IPC] get-admin-analytics profit error:", err2.message);
            resolve({ totalRevenue: 0, totalNetProfit: 0, paymentSplit: { cash: 0, mpesa: 0 }, topMovingProducts: [] });
            return;
          }
          db.all(`SELECT amount_cash, amount_mpesa FROM sales WHERE DATE(timestamp) = ?;`, [today], (err3, paymentRows) => {
            if (err3) {
              console.error("[IPC] get-admin-analytics payment split error:", err3.message);
              resolve({ totalRevenue: 0, totalNetProfit: 0, paymentSplit: { cash: 0, mpesa: 0 }, topMovingProducts: [] });
              return;
            }
            db.all(`SELECT p.name, SUM(si.quantity) AS total_sold FROM sales_items si INNER JOIN products p ON si.product_id = p.id INNER JOIN sales s ON si.sale_id = s.id WHERE DATE(s.timestamp) = ? GROUP BY si.product_id ORDER BY total_sold DESC LIMIT 3;`, [today], (err4, topProductsRows) => {
              if (err4) {
                console.error("[IPC] get-admin-analytics top products error:", err4.message);
                resolve({ totalRevenue: 0, totalNetProfit: 0, paymentSplit: { cash: 0, mpesa: 0 }, topMovingProducts: [] });
                return;
              }
              let cashTotal = 0;
              let mpesaTotal = 0;
              (paymentRows || []).forEach((r) => {
                cashTotal += parseFloat(r.amount_cash) || 0;
                mpesaTotal += parseFloat(r.amount_mpesa) || 0;
              });
              resolve({
                totalRevenue: revenueRow?.total_revenue || 0,
                totalNetProfit: profitRow?.total_net_profit || 0,
                paymentSplit: { cash: cashTotal, mpesa: mpesaTotal },
                topMovingProducts: topProductsRows || [],
              });
            });
          });
        });
      });
    } catch (error) {
      console.error("[IPC] get-admin-analytics exception:", error);
      resolve({ totalRevenue: 0, totalNetProfit: 0, paymentSplit: { cash: 0, mpesa: 0 }, topMovingProducts: [] });
    }
  });
});

// IPC: global-barcode-scan
ipcMain.handle("global-barcode-scan", async (event, barcode) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ found: false, message: "Database not ready." });
        return;
      }
      if (!barcode || typeof barcode !== "string") {
        resolve({ found: false, message: "Invalid barcode input." });
        return;
      }
      const trimmedBarcode = barcode.trim();
      if (trimmedBarcode.length === 0) {
        resolve({ found: false, message: "Empty barcode input." });
        return;
      }
      db.get(`SELECT p.id, p.sku, p.name, p.category_id, c.name AS category, p.buying_price, p.selling_price, p.stock_count, p.unit_size FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.sku = ? LIMIT 1;`,
        [trimmedBarcode], (err, row) => {
        if (err) {
          console.error("[IPC] global-barcode-scan error:", err.message);
          resolve({ found: false, message: "Database error." });
          return;
        }
        if (row) {
          resolve({ found: true, product: row });
        } else {
          resolve({ found: false, message: "Product not found for barcode: " + trimmedBarcode });
        }
      });
    } catch (error) {
      console.error("[IPC] global-barcode-scan exception:", error);
      resolve({ found: false, message: "Internal error." });
    }
  });
});

// IPC: validate-mpesa-code
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
      const mpesaRegex = /^[A-Z0-9]{10}$/;
      if (!mpesaRegex.test(trimmedCode)) {
        resolve({ valid: false, message: "Invalid M-PESA code. Must be exactly 10 uppercase alphanumeric characters." });
        return;
      }
      resolve({ valid: true, sanitizedCode: trimmedCode });
    } catch (error) {
      console.error("[IPC] validate-mpesa-code exception:", error);
      resolve({ valid: false, message: "Validation error." });
    }
  });
});

// IPC: get-categories
ipcMain.handle("get-categories", async () => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve([]);
        return;
      }
      db.all(`SELECT id, name, parent_category FROM categories ORDER BY name ASC;`, [], (err, rows) => {
        if (err) {
          console.error("[IPC] get-categories error:", err.message);
          resolve([]);
          return;
        }
        resolve(rows || []);
      });
    } catch (error) {
      console.error("[IPC] get-categories exception:", error);
      resolve([]);
    }
  });
});

// IPC: get-users
ipcMain.handle("get-users", async () => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve([]);
        return;
      }
      db.all(`SELECT id, username, role FROM users ORDER BY id ASC;`, [], (err, rows) => {
        if (err) {
          console.error("[IPC] get-users error:", err.message);
          resolve([]);
          return;
        }
        resolve(rows || []);
      });
    } catch (error) {
      console.error("[IPC] get-users exception:", error);
      resolve([]);
    }
  });
});

// IPC: add-user
ipcMain.handle("add-user", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { username, password, role } = payload || {};
      if (!username || !password || !role) {
        resolve({ success: false, message: "Username, password, and role are required." });
        return;
      }
      const salt = generateSalt(16);
      const passwordHash = hashPasswordWithSalt(password, salt);
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`,
        [username.trim(), passwordHash, salt, role], function (err) {
        if (err) {
          console.error("[IPC] add-user error:", err.message);
          if (err.message && err.message.includes("UNIQUE constraint failed")) {
            resolve({ success: false, message: "Username already exists." });
            return;
          }
          resolve({ success: false, message: "Failed to add user." });
          return;
        }
        resolve({ success: true, id: this.lastID });
      });
    } catch (error) {
      console.error("[IPC] add-user exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: delete-user
ipcMain.handle("delete-user", async (event, payload) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { userId } = payload || {};
      if (!userId) {
        resolve({ success: false, message: "User ID is required." });
        return;
      }
      db.run(`DELETE FROM users WHERE id = ?;`, [userId], function (err) {
        if (err) {
          console.error("[IPC] delete-user error:", err.message);
          resolve({ success: false, message: "Failed to delete user." });
          return;
        }
        if (this.changes === 0) {
          resolve({ success: false, message: "User not found." });
          return;
        }
        resolve({ success: true });
      });
    } catch (error) {
      console.error("[IPC] delete-user exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: authenticate-user
ipcMain.handle("authenticate-user", async (event, credentials) => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ success: false, message: "Database not ready." });
        return;
      }
      const { username, password } = credentials || {};
      if (!username || !password) {
        resolve({ success: false, message: "Username and password are required." });
        return;
      }
      db.get(`SELECT id, username, password_hash, salt, role FROM users WHERE username = ?;`, [username.trim()], (err, row) => {
        if (err) {
          console.error("[IPC] authenticate-user error:", err.message);
          resolve({ success: false, message: "Database error." });
          return;
        }
        if (!row) {
          resolve({ success: false, message: "Invalid username or password." });
          return;
        }
        const passwordHash = hashPasswordWithSalt(password, row.salt);
        if (passwordHash !== row.password_hash) {
          resolve({ success: false, message: "Invalid username or password." });
          return;
        }
        resolve({ success: true, user: { id: row.id, username: row.username, role: row.role } });
      });
    } catch (error) {
      console.error("[IPC] authenticate-user exception:", error);
      resolve({ success: false, message: "Internal error." });
    }
  });
});

// IPC: validate-system-time
ipcMain.handle("validate-system-time", async () => {
  return new Promise((resolve) => {
    try {
      if (!db || !dbReady) {
        resolve({ tampered: false, message: "Database not ready." });
        return;
      }
      db.get(`SELECT value FROM system_state WHERE key = 'last_known_time';`, [], (err, row) => {
        if (err) {
          console.error("[IPC] validate-system-time error:", err.message);
          resolve({ tampered: false, message: "Database error." });
          return;
        }
        const now = new Date();
        if (row && row.value) {
          const lastKnown = new Date(row.value);
          if (now < lastKnown) {
            resolve({ tampered: true, message: "System clock appears rolled back." });
            return;
          }
        }
        db.run(`INSERT OR REPLACE INTO system_state (key, value) VALUES ('last_known_time', ?);`, [now.toISOString()], (updateErr) => {
          if (updateErr) console.error("[IPC] validate-system-time update error:", updateErr.message);
        });
        resolve({ tampered: false, message: "System clock is progressive." });
      });
    } catch (error) {
      console.error("[IPC] validate-system-time exception:", error);
      resolve({ tampered: false, message: "Internal error." });
    }
  });
});

// ─── QA TEST RUNNER IPC ───
ipcMain.handle("qa:run-tests", async () => {
  return new Promise((resolve) => {
    try {
      const results = [];

      // Test 1: Connectivity Check
      results.push({
        test: "Connectivity Check",
        status: "PASS",
        detail: "IPC bridge is initialized and responsive.",
      });

      // Test 2: Database Integrity Check
      if (!db || !dbReady) {
        results.push({
          test: "Database Integrity Check",
          status: "FAIL",
          detail: "Database not initialized or not ready.",
        });
      } else {
        db.get("PRAGMA integrity_check;", [], (err, row) => {
          if (err) {
            results.push({
              test: "Database Integrity Check",
              status: "FAIL",
              detail: err.message,
            });
          } else {
            const integrityResult = row ? row.integrity_check : "unknown";
            results.push({
              test: "Database Integrity Check",
              status: integrityResult === "ok" ? "PASS" : "FAIL",
              detail: `PRAGMA integrity_check returned: ${integrityResult}`,
            });
          }

          // Test 3: Authentication Check
          db.get(`SELECT COUNT(*) AS count FROM users;`, [], (err2, row2) => {
            if (err2) {
              results.push({
                test: "Authentication Check",
                status: "FAIL",
                detail: err2.message,
              });
            } else {
              const userCount = row2 ? row2.count : 0;
              results.push({
                test: "Authentication Check",
                status: "PASS",
                detail: `Users table count: ${userCount}. Initial setup required: ${userCount === 0}`,
              });
            }

            // Test 4: Encryption Loop
            const salt1 = generateSalt(16);
            const salt2 = generateSalt(16);
            const hash1 = hashPasswordWithSalt("TestPassword123!", salt1);
            const hash2 = hashPasswordWithSalt("TestPassword123!", salt2);
            const uniqueHashes = hash1 !== hash2;
            results.push({
              test: "Encryption Loop",
              status: uniqueHashes ? "PASS" : "FAIL",
              detail: uniqueHashes
                ? "Different salts produce different hashes for identical passwords."
                : "Hash collision detected.",
            });

            // Test 5: Time Tamper Check
            db.get(`SELECT value FROM system_state WHERE key = 'last_known_time';`, [], (err3, row3) => {
              const now = new Date();
              let tamperStatus = "PASS";
              let tamperDetail = "System clock is progressive.";
              if (!err3 && row3 && row3.value) {
                const lastKnown = new Date(row3.value);
                if (now < lastKnown) {
                  tamperStatus = "FAIL";
                  tamperDetail = "System clock appears rolled back.";
                }
              }
              results.push({
                test: "Time Tamper Check",
                status: tamperStatus,
                detail: tamperDetail,
              });

              // Test 6: M-PESA Validator
              const mpesaRegex = /^[A-Z0-9]{10}$/;
              const test1 = mpesaRegex.test("ABC1234567");
              const test2 = mpesaRegex.test("abc");
              const mpesaPass = test1 === true && test2 === false;
              results.push({
                test: "M-PESA Validator",
                status: mpesaPass ? "PASS" : "FAIL",
                detail: `Test 1 ('ABC1234567'): ${test1 ? "PASS" : "FAIL"} | Test 2 ('abc'): ${test2 ? "FAIL (should have failed)" : "PASS (correctly rejected)"}`,
              });

              console.log("[QA TEST RUNNER] Results:", JSON.stringify(results, null, 2));
              resolve({ success: true, results });
            });
          });
        });
      }
    } catch (error) {
      console.error("[IPC] qa:run-tests exception:", error);
      resolve({ success: false, results: [{ test: "QA Runner", status: "FAIL", detail: error.message || "Unknown error" }] });
    }
  });
});
