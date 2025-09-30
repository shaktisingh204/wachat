
'use server';

import { connectToDatabase } from '../src/lib/mongodb';
import { planFeaturesDefaults } from '../src/lib/plans';
import type { Plan } from '../src/lib/definitions';
import { ObjectId } from 'mongodb';

async function assignDefaultPlan() {
  console.log('Connecting to database...');
  const { db } = await connectToDatabase();
  console.log('Connected.');

  // 1. Define and create the default plan if it doesn't exist
  console.log('Upserting Default Plan...');
  const defaultPlan: Omit<Plan, '_id' | 'createdAt'> = {
    name: 'Default Plan',
    price: 0,
    currency: 'INR',
    isPublic: true,
    isDefault: true,
    projectLimit: 1,
    agentLimit: 1,
    attributeLimit: 5,
    templateLimit: 10,
    flowLimit: 2,
    metaFlowLimit: 2,
    cannedMessageLimit: 10,
    signupCredits: 100,
    messageCosts: {
      marketing: 0.8,
      utility: 0.35,
      authentication: 0.35,
    },
    features: planFeaturesDefaults,
  };

  const planResult = await db.collection('plans').findOneAndUpdate(
    { name: 'Default Plan' },
    { $setOnInsert: { ...defaultPlan, createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );

  const defaultPlanId = planResult?._id;

  if (!defaultPlanId) {
    console.error('Could not create or find the default plan.');
    process.exit(1);
  }
  console.log(`Default Plan ID: ${defaultPlanId}`);

  // 2. Update all users that do not have a planId
  console.log('Finding users without a plan...');
  const usersToUpdate = await db.collection('users').find({ planId: { $exists: false } }).project({ _id: 1 }).toArray();
  const userIdsToUpdate = usersToUpdate.map(u => u._id);

  if (userIdsToUpdate.length > 0) {
    console.log(`Found ${userIdsToUpdate.length} user(s) to update.`);
    const result = await db.collection('users').updateMany(
      { _id: { $in: userIdsToUpdate } },
      { 
        $set: { 
            planId: defaultPlanId,
            credits: defaultPlan.signupCredits 
        } 
      }
    );
    console.log(`Successfully updated ${result.modifiedCount} user(s).`);
  } else {
    console.log('No users found needing a plan assignment.');
  }

  // 3. Ensure the signup logic uses this default plan going forward (handled in user.actions.ts)
  console.log('Migration complete.');
  process.exit(0);
}

assignDefaultPlan().catch(console.error);
