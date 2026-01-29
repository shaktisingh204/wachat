'use strict';
const { MongoClient } = require('mongodb');

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env');
}
if (!process.env.MONGODB_DB) {
  throw new Error('Please define the MONGODB_DB environment variable inside .env');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 90,
  });

  await client.connect();
  const db = client.db(process.env.MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

module.exports = { connectToDatabase };
