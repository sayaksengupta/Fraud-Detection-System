# Fraud Detection System

## Overview
This is a real-time fraud detection system built with Node.js, Express, Kafka, and SQLite. It processes financial transactions from a Kafka topic (`transactions`), applies fraud detection rules, and logs flagged transactions to a SQLite database. Invalid transactions are sent to a Dead Letter Queue (DLQ) topic (`fraud-detection-dlq`) and stored in the database for auditing. The system exposes RESTful endpoints to retrieve flagged transactions and DLQ messages.

## Features
- **Real-Time Processing**: Consumes transactions from Kafka, validates them, and applies fraud detection rules.
- **Fraud Detection**: Flags transactions based on high amounts, round numbers, rapid succession, or suspicious locations.
- **Dead Letter Queue**: Handles invalid transactions by sending them to a DLQ topic and logging them in the database.
- **REST API**: Provides endpoints to query flagged transactions and DLQ messages with pagination.
- **Logging**: Uses `winston` for detailed logging with daily rotation.
- **Caching**: Uses `node-cache` to prevent duplicate transaction processing.

## Project Structure
```
fraud-detection/
├── kafka/
│   └── consumer.js        # Kafka consumer for processing transactions and DLQ
├── models/
│   └── flaggedTransaction.js  # SQLite database operations
├── routes/
│   └── frauds.js         # Express routes for API endpoints
├── services/
│   └── fraudDetection.js # Fraud detection and validation logic
├── utils/
│   └── logger.js         # Winston logger configuration
├── logs/
│   └── app-YYYY-MM-DD.log  # Daily log files
├── app.js                # Main Express application
├── producer.js           # Kafka producer for test transactions
├── flagged_transactions.db  # SQLite database
├── .env                  # Environment variables
├── package.json          # Project dependencies
└── README.md             # This file
```

## Prerequisites
- **Node.js**: v14 or higher
- **Kafka**: Running on `localhost:9092` (or configure via `.env`)
- **SQLite**: No installation needed; uses `sqlite3` module
- **Docker** (optional): For running Kafka
- **curl**: For testing API endpoints

## Setup

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd fraud-detection
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
   Required packages: `kafkajs`, `express`, `sqlite3`, `winston`, `winston-daily-rotate-file`, `dotenv`, `node-cache`

3. **Set Up Kafka**:
   - Install and run Kafka/Zookeeper locally or via Docker:
     ```bash
     docker-compose up -d
     ```
     Example `docker-compose.yml`:
     ```yaml
     version: '3'
     services:
       zookeeper:
         image: confluentinc/cp-zookeeper:latest
         environment:
           ZOOKEEPER_CLIENT_PORT: 2181
           ZOOKEEPER_TICK_TIME: 2000
         ports:
           - 2181:2181
       kafka:
         image: confluentinc/cp-kafka:latest
         depends_on:
           - zookeeper
         ports:
           - 9092:9092
         environment:
           KAFKA_BROKER_ID: 1
           KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
           KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
           KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
     ```

4. **Configure Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   PORT=3000
   KAFKA_BROKER=localhost:9092
   ```

5. **Create Logs Directory**:
   ```bash
   mkdir logs
   ```

6. **Initialize Database**:
   The SQLite database (`flagged_transactions.db`) is created automatically on startup, with tables `flagged_transactions` and `dlq_transactions`.

## Running the Application
1. **Start the Application**:
   ```bash
   node app.js
   ```
   This starts the Express server on `http://localhost:3000` and the Kafka consumers for `transactions` and `fraud-detection-dlq` topics.

2. **Check Logs**:
   Logs are written to `logs/app-YYYY-MM-DD.log`. Example:
   ```
   {"level":"info","message":"Connected to SQLite database","timestamp":"2025-08-04T20:20:XXZ"}
   {"level":"info","message":"Server running on port 3000","timestamp":"2025-08-04T20:20:XXZ"}
   ```

## Testing
Use `producer.js` to send test transactions to Kafka and `curl` to query the API.

1. **Send Test Transactions**:
   ```bash
   node producer.js <test-case>
   ```
   Available test cases:
   - `high_amount`: Transaction with high amount (`amount: 6000`, `userId: user_201`).
   - `round_number`: Transaction with round amount (`amount: 2000`).
   - `rapid_succession`: Multiple transactions from the same user in quick succession.
   - `success`: Valid transaction with no fraud flags.
   - `dlq`: Invalid transaction (e.g., empty `userId`, non-numeric `amount`).

   Example:
   ```bash
   node producer.js dlq
   ```

2. **Query Flagged Transactions**:
   - All flagged transactions:
     ```bash
     curl "http://localhost:3000/frauds?page=1&limit=10"
     ```
   - Transactions by `userId`:
     ```bash
     curl "http://localhost:3000/frauds/user_201?page=1&limit=10"
     ```
   - DLQ transactions:
     ```bash
     curl "http://localhost:3000/frauds/dlq-transactions?page=1&limit=10"
     ```

   Example response for `/frauds/dlq-transactions`:
   ```json
   {
     "data": [
       {
         "id": 1,
         "transactionData": "{\"transactionId\":\"txn_106\",\"userId\":\"\",\"amount\":\"invalid\",\"location\":\"USA\",\"timestamp\":\"invalid-timestamp\"}",
         "errorMessage": "Error: userId must be a non-empty string",
         "timestamp": "2025-08-04T20:20:XXZ"
       }
     ],
     "pagination": {
       "currentPage": 1,
       "totalPages": 1,
       "totalItems": 1,
       "limit": 10
     }
   }
   ```

3. **Inspect Database**:
   ```bash
   sqlite3 flagged_transactions.db
   SELECT * FROM flagged_transactions;
   SELECT * FROM dlq_transactions;
   ```

## API Endpoints
- **GET /frauds**:
  - Retrieve all flagged transactions.
  - Query params: `page` (default: 1), `limit` (default: 20).
  - Example: `curl "http://localhost:3000/frauds?page=1&limit=10"`
- **GET /frauds/:userId**:
  - Retrieve flagged transactions for a specific `userId`.
  - Query params: `page`, `limit`.
  - Example: `curl "http://localhost:3000/frauds/user_201?page=1&limit=10"`
- **GET /frauds/dlq-transactions**:
  - Retrieve DLQ transactions.
  - Query params: `page`, `limit`.
  - Example: `curl "http://localhost:3000/frauds/dlq-transactions?page=1&limit=10"`

## Troubleshooting
- **Empty API Responses**:
  - Check `logs/app-YYYY-MM-DD.log` for errors (e.g., `"Failed to query DLQ transactions"`).
  - Verify `flagged_transactions.db` path and contents:
    ```bash
    sqlite3 flagged_transactions.db "SELECT * FROM dlq_transactions"
    ```
  - Reset Kafka consumer offsets:
    ```bash
    kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group fraud-detection-group --reset-offsets --to-earliest --topic transactions --execute
    kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group fraud-detection-dlq-group --reset-offsets --to-earliest --topic fraud-detection-dlq --execute
    ```
- **Kafka Connection Issues**:
  - Ensure Kafka is running on `localhost:9092` or update `KAFKA_BROKER` in `.env`.
- **Database Issues**:
  - Clear database for fresh testing:
    ```bash
    sqlite3 flagged_transactions.db
    DELETE FROM flagged_transactions;
    DELETE FROM dlq_transactions;
    ```

## Shutting Down
- Stop the application with `Ctrl+C`.
- The application automatically closes the database and Kafka consumers gracefully.

## Notes
- The system uses `node-cache` to prevent duplicate transaction processing (TTL: 1 hour).
- DLQ messages are retried with a 5-minute delay to avoid overloading.
- Logs rotate daily and are stored in the `logs/` directory.