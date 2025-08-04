require("dotenv").config();
const express = require("express");
const { runConsumer, stopConsumer } = require("./kafka/consumer");
const { closeDatabase } = require("./models/flaggedTransaction");
const logger = require("./utils/logger");
const routes = require("./routes/index");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/", routes);

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

runConsumer().catch((error) => {
  logger.error("Failed to run Kafka consumer", { error });
  process.exit(1);
});

const shutdown = async () => {
  logger.info("Shutting down application");
  await stopConsumer();
  closeDatabase();
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
