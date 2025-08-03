const FraudDetector = require("../services/fraudDetection");

describe("FraudDetector", () => {
  let detector;

  beforeEach(() => {
    detector = new FraudDetector();
  });

  test("should flag high amount outside USA", () => {
    const transaction = {
      amount: 6000,
      location: "Nigeria",
      timestamp: "2025-07-30T10:12:00Z",
      userId: "user_123",
      transactionId: "txn_789",
    };
    const reasons = detector.detect(transaction);
    expect(reasons).toContain("high_amount");
  });

  test("should flag rapid succession transactions", () => {
    const transaction1 = {
      amount: 100,
      location: "USA",
      timestamp: "2025-07-30T10:12:00Z",
      userId: "user_123",
      transactionId: "txn_790",
    };
    const transaction2 = {
      amount: 200,
      location: "USA",
      timestamp: "2025-07-30T10:12:05Z",
      userId: "user_123",
      transactionId: "txn_791",
    };
    detector.detect(transaction1);
    const reasons = detector.detect(transaction2);
    expect(reasons).toContain("rapid_succession");
  });

  test("should flag round number amounts", () => {
    const transaction = {
      amount: 5000,
      location: "USA",
      timestamp: "2025-07-30T10:12:00Z",
      userId: "user_123",
      transactionId: "txn_792",
    };
    const reasons = detector.detect(transaction);
    expect(reasons).toContain("round_number");
  });
});
