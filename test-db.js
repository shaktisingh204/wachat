const { MongoClient } = require('mongodb');
async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/sabnode";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const doc = await db.collection('crm_kb_articles').findOne({});
  console.log("Sample article:", doc);
  await client.close();
}
run().catch(console.dir);
