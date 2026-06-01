// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddBillingCoreTables1708535112230 — creates billingEntitlement,
// billingCustomer, billingMeter, billingPrice, billingProduct,
// billingSubscriptionItem, billingSubscription tables in Postgres.
//
// In SabNode (MongoDB) there is no DDL. The equivalent is ensuring the
// relevant collections have appropriate indexes. Index creation is idempotent.
//
// Run this module's `up()` function once during CRM initialisation to apply
// the Mongo indexes. The `down()` function drops them.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  // billingEntitlement: unique on (key, workspaceId)
  await db.collection('sabcrm_billingentitlement').createIndexes([
    { key: { key: 1, workspaceId: 1 }, unique: true, name: 'IDX_BILLING_ENTITLEMENT_KEY_WORKSPACE_ID_UNIQUE' },
    { key: { stripeCustomerId: 1 }, name: 'IDX_BILLING_ENTITLEMENT_STRIPE_CUSTOMER_ID' },
  ]);

  // billingCustomer: unique on workspaceId and stripeCustomerId
  await db.collection('sabcrm_billingcustomer').createIndexes([
    { key: { workspaceId: 1 }, unique: true, name: 'UQ_BILLING_CUSTOMER_WORKSPACE_ID' },
    { key: { stripeCustomerId: 1 }, unique: true, name: 'UQ_BILLING_CUSTOMER_STRIPE_CUSTOMER_ID' },
  ]);

  // billingMeter: unique on stripeMeterId
  await db.collection('sabcrm_billingmeter').createIndexes([
    { key: { stripeMeterId: 1 }, unique: true, name: 'UQ_BILLING_METER_STRIPE_METER_ID' },
  ]);

  // billingPrice: unique on stripePriceId
  await db.collection('sabcrm_billingprice').createIndexes([
    { key: { stripePriceId: 1 }, unique: true, name: 'UQ_BILLING_PRICE_STRIPE_PRICE_ID' },
  ]);

  // billingProduct: unique on stripeProductId
  await db.collection('sabcrm_billingproduct').createIndexes([
    { key: { stripeProductId: 1 }, unique: true, name: 'UQ_BILLING_PRODUCT_STRIPE_PRODUCT_ID' },
  ]);

  // billingSubscriptionItem: unique on stripeSubscriptionItemId and (billingSubscriptionId, stripeProductId)
  await db.collection('sabcrm_billingsubscriptionitem').createIndexes([
    { key: { stripeSubscriptionItemId: 1 }, unique: true, name: 'UQ_BILLING_SUBSCRIPTION_ITEM_STRIPE_SUBSCRIPTION_ITEM_ID' },
    { key: { billingSubscriptionId: 1, stripeProductId: 1 }, unique: true, name: 'IDX_BILLING_SUBSCRIPTION_ITEM_BILLING_SUBSCRIPTION_ID_STRIPE_PRODUCT_ID_UNIQUE' },
  ]);

  // billingSubscription: unique on stripeSubscriptionId; partial unique on workspaceId for active
  await db.collection('sabcrm_billingsubscription').createIndexes([
    { key: { stripeSubscriptionId: 1 }, unique: true, name: 'UQ_BILLING_SUBSCRIPTION_STRIPE_SUBSCRIPTION_ID' },
    { key: { workspaceId: 1 }, name: 'IDX_BILLING_SUBSCRIPTION_WORKSPACE_ID' },
  ]);
};

export const down = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_billingentitlement').dropIndexes();
  await db.collection('sabcrm_billingcustomer').dropIndexes();
  await db.collection('sabcrm_billingmeter').dropIndexes();
  await db.collection('sabcrm_billingprice').dropIndexes();
  await db.collection('sabcrm_billingproduct').dropIndexes();
  await db.collection('sabcrm_billingsubscriptionitem').dropIndexes();
  await db.collection('sabcrm_billingsubscription').dropIndexes();
};

export const migrationName = 'AddBillingCoreTables1708535112230';
