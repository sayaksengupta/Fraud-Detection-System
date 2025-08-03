require('dotenv').config();
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'test-producer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();

const transactionSets = {
  high_amount: [
    {
      transactionId: 'txn_101',
      userId: 'user_201',
      amount: 6100,
      location: 'Nigeria',
      timestamp: '2025-07-30T10:12:00Z'
    }
  ],
  round_number: [
    {
      transactionId: 'txn_102',
      userId: 'user_202',
      amount: 2000,
      location: 'USA',
      timestamp: '2025-07-30T10:12:00Z'
    }
  ],
  rapid_succession: [
    {
      transactionId: 'txn_103',
      userId: 'user_203',
      amount: 100,
      location: 'USA',
      timestamp: '2025-07-30T10:12:00Z'
    },
    {
      transactionId: 'txn_104',
      userId: 'user_203',
      amount: 150,
      location: 'USA',
      timestamp: '2025-07-30T10:12:05Z'
    }
  ],
  success: [
    {
      transactionId: 'txn_105',
      userId: 'user_204',
      amount: 750,
      location: 'USA',
      timestamp: '2025-07-30T10:12:00Z'
    }
  ],
  dlq: [
    {
      transactionId: 'txn_106',
      userId: 'user_205',
      amount: 100,
      location: 'USA',
      timestamp: 'invalid-timestamp' 
    }
  ]
};

const runProducer = async (setName) => {
  if (!transactionSets[setName]) {
    console.error(`Invalid set name: ${setName}. Available sets: ${Object.keys(transactionSets).join(', ')}`);
    process.exit(1);
  }

  try {
    await producer.connect();
    const transactions = transactionSets[setName];
    await producer.send({
      topic: 'transactions',
      messages: transactions.map(txn => ({ value: JSON.stringify(txn) })),
    });
    console.log(`${setName} test transactions sent`);
    await producer.disconnect();
  } catch (error) {
    console.error('Error sending transactions:', error);
  }
};


const setName = process.argv[2] || 'success'; 
runProducer(setName).catch(console.error);