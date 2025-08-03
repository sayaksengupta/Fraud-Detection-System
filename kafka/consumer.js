const { Kafka } = require('kafkajs');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const FraudDetector = require('../services/fraudDetection');
const { insertFlaggedTransaction, insertDLQTransaction } = require('../models/flaggedTransaction');

const kafka = new Kafka({
  clientId: 'fraud-detection',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'fraud-detection-group' });
const dlqConsumer = kafka.consumer({ groupId: 'fraud-detection-dlq-group' });
const producer = kafka.producer();
const cache = new NodeCache({ stdTTL: 3600 });
const fraudDetector = new FraudDetector();
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;
const DLQ_RETRY_DELAY = 5 * 60 * 1000;
const activeTimeouts = new Set();

const createTopicIfNotExists = async () => {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    const requiredTopics = ['transactions', 'fraud-detection-dlq'];
    for (const topic of requiredTopics) {
      if (!topics.includes(topic)) {
        await admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        });
        logger.info(`Created topic: ${topic}`);
      } else {
        logger.info(`Topic ${topic} already exists`);
      }
    }
  } catch (error) {
    logger.error('Error creating topic', { error });
    throw error;
  } finally {
    await admin.disconnect();
  }
};

const isRetryableError = (error) => {
  return !(error instanceof SyntaxError || error.message.includes('must be'));
};

const processMessage = async (message, retryCount = 0, isDLQ = false) => {
  try {
    const transaction = JSON.parse(message.value.toString());
    
    // Validate transaction
    fraudDetector.validateTransaction(transaction);
    
    logger.info(`${isDLQ ? 'DLQ ' : ''}Transaction received`, {
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      timestamp: transaction.timestamp
    });
    
    if (cache.has(transaction.transactionId)) {
      logger.info(`${isDLQ ? 'DLQ ' : ''}Duplicate transaction detected`, { transactionId: transaction.transactionId });
      return;
    }
    
    const reasons = fraudDetector.detect(transaction);
    if (reasons.length > 0) {
      logger.warn(`${isDLQ ? 'DLQ ' : ''}Fraud detected`, {
        transactionId: transaction.transactionId,
        userId: transaction.userId,
        reasons,
        timestamp: transaction.timestamp
      });
      insertFlaggedTransaction(transaction, reasons);
    } else {
      logger.info(`${isDLQ ? 'DLQ ' : ''}Transaction processed successfully`, { transactionId: transaction.transactionId });
    }
    
    cache.set(transaction.transactionId, true);
  } catch (error) {
    logger.error(`${isDLQ ? 'DLQ ' : ''}Error processing message`, { error, retryCount, transaction: message.value?.toString() });
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      const delay = isDLQ ? DLQ_RETRY_DELAY : BASE_DELAY * Math.pow(2, retryCount);
      logger.info(`${isDLQ ? 'DLQ ' : ''}Scheduling retry`, { retryCount: retryCount + 1, delay, transaction: message.value?.toString() });
      const timeoutId = setTimeout(() => {
        activeTimeouts.delete(timeoutId);
        processMessage(message, retryCount + 1, isDLQ);
      }, delay);
      activeTimeouts.add(timeoutId);
    } else {
      logger.error(`${isDLQ ? 'DLQ ' : ''}Max retries reached or non-retryable error, ${isDLQ ? 'logging to DB' : 'sending to DLQ'}`, { message: message.value?.toString() });
      if (isDLQ) {
        insertDLQTransaction(message.value?.toString(), error.message);
      } else {
        await sendToDLQ(message);
      }
    }
  }
};

const sendToDLQ = async (message) => {
  try {
    await producer.send({
      topic: 'fraud-detection-dlq',
      messages: [{ value: message.value }],
    });
    logger.info('Message sent to DLQ', { message: message.value?.toString() });
  } catch (error) {
    logger.error('Error sending to DLQ', { error, message: message.value?.toString() });
    await insertDLQTransaction(message.value?.toString(), error.message);
  }
};

const runConsumer = async () => {
  try {
    await createTopicIfNotExists();
    await producer.connect();
    await consumer.connect();
    await dlqConsumer.connect();
    
    await consumer.subscribe({ topic: 'transactions', fromBeginning: true });
    await dlqConsumer.subscribe({ topic: 'fraud-detection-dlq', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
        await processMessage(message, 0, false);
      },
    });

    await dlqConsumer.run({
      eachMessage: async ({ message }) => {
        await processMessage(message, 0, true);
      },
    });
  } catch (error) {
    logger.error('Consumer error', { error });
    throw error;
  }
};

const stopConsumer = async () => {
  try {
    logger.info('Stopping consumers and clearing active timeouts');
    activeTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    activeTimeouts.clear();
    await consumer.disconnect();
    await dlqConsumer.disconnect();
    await producer.disconnect();
    logger.info('Consumers and producer disconnected');
  } catch (error) {
    logger.error('Error during consumer shutdown', { error });
  }
};

module.exports = { runConsumer, stopConsumer };