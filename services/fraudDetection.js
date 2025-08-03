class FraudDetector {
  constructor() {
    this.lastTransactionTimes = new Map();
  }

  validateTransaction(transaction) {
    if (!transaction || typeof transaction !== "object") {
      throw new Error("Transaction must be an object");
    }
    if (
      !transaction.transactionId ||
      typeof transaction.transactionId !== "string"
    ) {
      throw new Error("transactionId must be a non-empty string");
    }
    if (!transaction.userId || typeof transaction.userId !== "string") {
      throw new Error("userId must be a non-empty string");
    }
    if (
      typeof transaction.amount !== "number" ||
      transaction.amount <= 0 ||
      isNaN(transaction.amount)
    ) {
      throw new Error("amount must be a positive number");
    }
    if (!transaction.location || typeof transaction.location !== "string") {
      throw new Error("location must be a non-empty string");
    }
    const currentTime = new Date(transaction.timestamp).getTime();
    if (isNaN(currentTime)) {
      throw new Error("timestamp must be a valid ISO 8601 date string");
    }
  }

  detect(transaction) {
    // Validate transaction first
    this.validateTransaction(transaction);

    const reasons = [];
    const currentTime = new Date(transaction.timestamp).getTime();

    // Rule 1: Amount > $5000 and location is not "USA"
    if (transaction.amount > 5000 && transaction.location !== "USA") {
      reasons.push("high_amount");
    }

    // Rule 2: Multiple transactions from same userId in < 10 seconds
    const userId = transaction.userId;
    if (this.lastTransactionTimes.has(userId)) {
      const lastTime = this.lastTransactionTimes.get(userId);
      const timeDiff = (currentTime - lastTime) / 1000;
      if (timeDiff < 10) {
        reasons.push("rapid_succession");
      }
    }
    this.lastTransactionTimes.set(userId, currentTime);

    // Rule 3: Amount is a round number divisible by 1000
    if (transaction.amount % 1000 === 0) {
      reasons.push("round_number");
    }

    return reasons;
  }
}

module.exports = FraudDetector;
