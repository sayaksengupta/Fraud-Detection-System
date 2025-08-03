const express = require("express");
const router = express.Router();
const {
  getAllFlaggedTransactions,
  getFlaggedTransactionsByUserId,
} = require("../models/flaggedTransaction");

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (page < 1 || limit < 1) {
      return res
        .status(400)
        .json({ error: "Page and limit must be positive integers" });
    }

    const offset = (page - 1) * limit;
    const { transactions, total } = await getAllFlaggedTransactions(
      limit,
      offset
    );
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: transactions,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (page < 1 || limit < 1) {
      return res
        .status(400)
        .json({ error: "Page and limit must be positive integers" });
    }

    const offset = (page - 1) * limit;
    const { transactions, total } = await getFlaggedTransactionsByUserId(
      userId,
      limit,
      offset
    );
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: transactions,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
