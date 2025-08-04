const express = require("express");
const fraudsRouter = require("./frauds");
const transactionsRouter = require("./transactions");

const router = express.Router();

// frauds routes
router.use("/frauds", fraudsRouter);

// transaction routes
router.use("/transactions", transactionsRouter)

module.exports = router;