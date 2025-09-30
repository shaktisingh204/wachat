
// This script is designed to be run directly via the MongoDB Shell (mongosh).
// It will create a "Default Plan" if one doesn't exist, and then assign
// that plan's ID to all users who currently do not have a planId.

// How to run:
// mongosh "your_mongodb_connection_string" --file scripts/assign-default-plan.mongo.js

// Note: The database to use is determined by your connection string.

console.log("Starting plan assignment migration...");

// 1. Define and create the default plan if it doesn't exist
const defaultPlan = {
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
  features: {
    overview: true, campaigns: true, liveChat: true, contacts: true, templates: true, catalog: true, ecommerce: false, flowBuilder: true,
    metaFlows: true, whatsappAds: false, webhooks: true, settingsBroadcast: true, settingsAutoReply: true,
    settingsMarketing: false, settingsTemplateLibrary: true, settingsCannedMessages: true, settingsAgentsRoles: true,
    settingsCompliance: true, settingsUserAttributes: true, apiAccess: false,
    urlShortener: true, qrCodeMaker: true, numbers: true, billing: true, notifications: true,
    instagramFeed: false, instagramStories: false, instagramReels: false, instagramMessages: false, chatbot: false,
    email: true,
  },
};

const planResult = db.collection('plans').updateOne(
  { name: 'Default Plan' },
  { 
    $setOnInsert: { 
      ...defaultPlan, 
      createdAt: new Date() 
    } 
  },
  { upsert: true }
);

if (planResult.upsertedId) {
  console.log(`Created new Default Plan with ID: ${planResult.upsertedId}`);
} else {
  console.log("Default Plan already exists.");
}

// 2. Fetch the default plan's ID
const defaultPlanDoc = db.collection('plans').findOne({ name: 'Default Plan' });

if (!defaultPlanDoc) {
  throw new Error("Fatal: Could not find or create the default plan. Migration cannot continue.");
}

const defaultPlanId = defaultPlanDoc._id;
console.log(`Using Default Plan ID: ${defaultPlanId}`);

// 3. Find and update all users that do not have a planId
const usersToUpdate = db.collection('users').find({ planId: { $exists: false } }).toArray();

if (usersToUpdate.length > 0) {
    console.log(`Found ${usersToUpdate.length} user(s) to update.`);

    const result = db.collection('users').updateMany(
      { _id: { $in: usersToUpdate.map(u => u._id) } },
      { 
        $set: { 
            planId: defaultPlanId,
            credits: defaultPlan.signupCredits 
        } 
      }
    );
    console.log(`Successfully updated ${result.modifiedCount} user(s).`);

} else {
    console.log("No users found needing a plan assignment.");
}

console.log("Migration complete.");
