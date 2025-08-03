const sqlite3 = require("sqlite3").verbose();
const logger = require("../utils/logger");
const db = new sqlite3.Database("./flagged_transactions.db", (err) => {
  if (err) {
    logger.error("Failed to connect to SQLite database", {
      error: err.message,
    });
    throw err;
  }
  logger.info("Connected to SQLite database");
});

db.serialize(() => {
  try {
    db.run(
      `CREATE TABLE IF NOT EXISTS flagged_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transactionId TEXT,
      userId TEXT,
      amount REAL,
      location TEXT,
      timestamp TEXT,
      reasons TEXT
    )`,
      (err) => {
        if (err) {
          logger.error("Failed to create flagged_transactions table", {
            error: err.message,
          });
        } else {
          logger.info("flagged_transactions table ready");
        }
      }
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS dlq_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transactionData TEXT,
      errorMessage TEXT,
      timestamp TEXT
    )`,
      (err) => {
        if (err) {
          logger.error("Failed to create dlq_transactions table", {
            error: err.message,
          });
        } else {
          logger.info("dlq_transactions table ready");
        }
      }
    );
  } catch (err) {
    logger.error("Error during database initialization", {
      error: err.message,
    });
    throw err;
  }
});

function insertFlaggedTransaction(transaction, reasons) {
  try {
    if (!transaction || !reasons) {
      const error = new Error("Missing transaction or reasons");
      logger.error("Invalid input for insertFlaggedTransaction", {
        transaction,
        reasons,
      });
      throw error;
    }
    const stmt = db.prepare(
      `INSERT INTO flagged_transactions (transactionId, userId, amount, location, timestamp, reasons) VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      transaction.transactionId,
      transaction.userId,
      transaction.amount,
      transaction.location,
      transaction.timestamp,
      reasons.join(","),
      (err) => {
        if (err) {
          logger.error("Failed to insert flagged transaction", {
            error: err.message,
            transactionId: transaction.transactionId,
          });
          throw err;
        }
      }
    );
    stmt.finalize((err) => {
      if (err) {
        logger.error("Failed to finalize flagged transaction statement", {
          error: err.message,
        });
        throw err;
      }
    });
  } catch (err) {
    logger.error("Error in insertFlaggedTransaction", { error: err.message });
    throw err;
  }
}

function insertDLQTransaction(transactionData, errorMessage) {
  try {
    if (!transactionData || !errorMessage) {
      const error = new Error("Missing transactionData or errorMessage");
      logger.error("Invalid input for insertDLQTransaction", {
        transactionData,
        errorMessage,
      });
      throw error;
    }
    console.log("Inserting DLQ transaction:", transactionData); // For debugging
    const stmt = db.prepare(
      `INSERT INTO dlq_transactions (transactionData, errorMessage, timestamp) VALUES (?, ?, ?)`
    );
    stmt.run(transactionData, errorMessage, new Date().toISOString(), (err) => {
      if (err) {
        logger.error("Failed to insert DLQ transaction", {
          error: err.message,
          transactionData,
        });
        throw err;
      }
      logger.info("DLQ transaction inserted", { transactionData });
    });
    stmt.finalize((err) => {
      if (err) {
        logger.error("Failed to finalize DLQ transaction statement", {
          error: err.message,
        });
        throw err;
      }
    });
  } catch (err) {
    logger.error("Error in insertDLQTransaction", { error: err.message });
    throw err;
  }
}

function getAllFlaggedTransactions(limit, offset) {
  return new Promise((resolve, reject) => {
    const result = { transactions: [], total: 0 };
    db.get(`SELECT COUNT(*) as count FROM flagged_transactions`, (err, row) => {
      if (err) {
        logger.error("Failed to count flagged transactions", {
          error: err.message,
        });
        return reject(new Error(`Database error: ${err.message}`));
      }
      result.total = row.count || 0;
      db.all(
        `SELECT * FROM flagged_transactions ORDER BY id DESC LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) {
            logger.error("Failed to query flagged transactions", {
              error: err.message,
              limit,
              offset,
            });
            return reject(new Error(`Database error: ${err.message}`));
          }
          result.transactions = rows || [];
          resolve(result);
        }
      );
    });
  });
}

function getFlaggedTransactionsByUserId(userId, limit, offset) {
  return new Promise((resolve, reject) => {
    const result = { transactions: [], total: 0 };
    db.get(
      `SELECT COUNT(*) as count FROM flagged_transactions WHERE userId = ?`,
      [userId],
      (err, row) => {
        if (err) {
          logger.error("Failed to count flagged transactions by userId", {
            error: err.message,
            userId,
          });
          return reject(new Error(`Database error: ${err.message}`));
        }
        result.total = row.count || 0;
        db.all(
          `SELECT * FROM flagged_transactions WHERE userId = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
          [userId, limit, offset],
          (err, rows) => {
            if (err) {
              logger.error("Failed to query flagged transactions by userId", {
                error: err.message,
                userId,
                limit,
                offset,
              });
              return reject(new Error(`Database error: ${err.message}`));
            }
            result.transactions = rows || [];
            resolve(result);
          }
        );
      }
    );
  });
}

function getDLQTransactions(limit, offset) {
  return new Promise((resolve, reject) => {
    const result = { transactions: [], total: 0 };
    db.get(`SELECT COUNT(*) as count FROM dlq_transactions`, (err, row) => {
      if (err) {
        logger.error("Failed to count DLQ transactions", {
          error: err.message,
        });
        return reject(new Error(`Database error: ${err.message}`));
      }
      result.total = row.count || 0;
      db.all(
        `SELECT * FROM dlq_transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) {
            logger.error("Failed to query DLQ transactions", {
              error: err.message,
              limit,
              offset,
            });
            return reject(new Error(`Database error: ${err.message}`));
          }
          result.transactions = rows || [];
          resolve(result);
        }
      );
    });
  });
}

function closeDatabase() {
  try {
    db.close((err) => {
      if (err) {
        logger.error("Failed to close database", { error: err.message });
        throw err;
      }
      logger.info("Database connection closed");
    });
  } catch (err) {
    logger.error("Error during database close", { error: err.message });
    throw err;
  }
}

module.exports = {
  insertFlaggedTransaction,
  insertDLQTransaction,
  getAllFlaggedTransactions,
  getFlaggedTransactionsByUserId,
  getDLQTransactions,
  closeDatabase,
};
