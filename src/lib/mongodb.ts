
import { MongoClient, Db } from 'mongodb';
import { config } from 'dotenv';

config(); // Load environment variables from .env file

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
  }
  if (!dbName) {
      throw new Error('Please define the MONGODB_DB environment variable inside .env');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Cap the connection pool size to 90% of the default (100)
  const client = new MongoClient(uri!, {
    maxPoolSize: 90,
  });

  await client.connect();

  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
