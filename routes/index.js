const express = require("express");
const fraudsRouter = require("./frauds");
const transactionsRouter = require("./transactions");
const healthRouter = require("./health");

const router = express.Router();

// frauds routes
router.use("/frauds", fraudsRouter);

// transaction routes
router.use("/transactions", transactionsRouter);

// health routes
router.use("/health", healthRouter);

module.exports = router;