const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./flagged_transactions.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS flagged_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transactionId TEXT,
    userId TEXT,
    amount REAL,
    location TEXT,
    timestamp TEXT,
    reasons TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS dlq_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transactionData TEXT,
    errorMessage TEXT,
    timestamp TEXT
  )`);
});

function insertFlaggedTransaction(transaction, reasons) {
  const stmt = db.prepare(`INSERT INTO flagged_transactions (transactionId, userId, amount, location, timestamp, reasons) VALUES (?, ?, ?, ?, ?, ?)`);
  stmt.run(transaction.transactionId, transaction.userId, transaction.amount, transaction.location, transaction.timestamp, reasons.join(','));
  stmt.finalize();
}

function insertDLQTransaction(transactionData, errorMessage) {
  const stmt = db.prepare(`INSERT INTO dlq_transactions (transactionData, errorMessage, timestamp) VALUES (?, ?, ?)`);
  stmt.run(transactionData, errorMessage, new Date().toISOString());
  stmt.finalize();
}

function getAllFlaggedTransactions(limit, offset) {
  return new Promise((resolve, reject) => {
    const result = { transactions: [], total: 0 };
    db.get(`SELECT COUNT(*) as count FROM flagged_transactions`, (err, row) => {
      if (err) return reject(err);
      result.total = row.count;
      db.all(`SELECT * FROM flagged_transactions ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) return reject(err);
        result.transactions = rows;
        resolve(result);
      });
    });
  });
}

function getFlaggedTransactionsByUserId(userId, limit, offset) {
  return new Promise((resolve, reject) => {
    const result = { transactions: [], total: 0 };
    db.get(`SELECT COUNT(*) as count FROM flagged_transactions WHERE userId = ?`, [userId], (err, row) => {
      if (err) return reject(err);
      result.total = row.count;
      db.all(`SELECT * FROM flagged_transactions WHERE userId = ? ORDER BY id DESC LIMIT ? OFFSET ?`, [userId, limit, offset], (err, rows) => {
        if (err) return reject(err);
        result.transactions = rows;
        resolve(result);
      });
    });
  });
}

function getDLQTransactions(limit, offset) {
  return new Promise((resolve, reject) => {
    const result = { transactions: [], total: 0 };
    db.get(`SELECT COUNT(*) as count FROM dlq_transactions`, (err, row) => {
      if (err) return reject(err);
      result.total = row.count;
      db.all(`SELECT * FROM dlq_transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
        if (err) return reject(err);
        result.transactions = rows;
        resolve(result);
      });
    });
  });
}

function closeDatabase() {
  db.close();
}

module.exports = {
  insertFlaggedTransaction,
  insertDLQTransaction,
  getAllFlaggedTransactions,
  getFlaggedTransactionsByUserId,
  getDLQTransactions,
  closeDatabase
};