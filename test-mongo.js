const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    const stream = db.collection('seo_audits').watch();
    console.log('Change streams supported!');
    await stream.close();
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.close();
  }
}
run();
