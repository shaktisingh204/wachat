const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env' });
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI");
    return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const est = await db.collection('crm_estimates').findOne({});
  console.log(JSON.stringify(est, null, 2));
  await client.close();
}
run();
