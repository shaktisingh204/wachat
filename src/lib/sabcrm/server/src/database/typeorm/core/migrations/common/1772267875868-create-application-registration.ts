// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: CreateApplicationRegistration1772267875868
//
// Postgres DDL intent:
//   Created two new tables:
//
//   1. core.applicationRegistration
//      Fields: id (uuid PK), universalIdentifier (uuid, unique non-deleted),
//              name (text), description (text?), logoUrl (text?), author (text?),
//              oAuthClientId (text, unique non-deleted), oAuthClientSecretHash (text?),
//              oAuthRedirectUris (text[]), oAuthScopes (text[]),
//              createdByUserId (uuid? → FK core.user ON DELETE SET NULL),
//              websiteUrl (text?), termsUrl (text?),
//              createdAt (timestamptz), updatedAt (timestamptz), deletedAt (timestamptz?)
//
//   2. core.applicationRegistrationVariable
//      Fields: id (uuid PK), key (text), encryptedValue (text), description (text),
//              isSecret (boolean DEFAULT true), isRequired (boolean DEFAULT false),
//              applicationRegistrationId (uuid → FK cascade),
//              createdAt (timestamptz), updatedAt (timestamptz)
//      Unique constraint: (key, applicationRegistrationId)
//
//   Also added `applicationRegistrationId` (uuid, nullable FK) to core.application.
//
// MongoDB equivalent:
//   - New collection: sabcrm_applicationRegistration
//   - New collection: sabcrm_applicationRegistrationVariable
//   - Sparse-unique indexes to replicate partial-unique Postgres constraints.
//   - The `sabcrm_application` documents gain an optional `applicationRegistrationId` field.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "CreateApplicationRegistration1772267875868";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  // sabcrm_applicationRegistration indexes
  const appReg = db.collection("sabcrm_applicationRegistration");

  // Partial unique index: universalIdentifier must be unique among non-deleted docs
  await appReg.createIndex(
    { universalIdentifier: 1 },
    {
      unique: true,
      sparse: true,
      partialFilterExpression: { deletedAt: { $exists: false } },
      name: "IDX_appReg_universalIdentifier_unique",
    },
  );

  // Partial unique index: oAuthClientId must be unique among non-deleted docs
  await appReg.createIndex(
    { oAuthClientId: 1 },
    {
      unique: true,
      sparse: true,
      partialFilterExpression: { deletedAt: { $exists: false } },
      name: "IDX_appReg_oAuthClientId_unique",
    },
  );

  // Regular index on createdByUserId
  await appReg.createIndex(
    { createdByUserId: 1 },
    { name: "IDX_appReg_createdByUserId" },
  );

  // sabcrm_applicationRegistrationVariable indexes
  const appRegVar = db.collection("sabcrm_applicationRegistrationVariable");

  await appRegVar.createIndex(
    { applicationRegistrationId: 1 },
    { name: "IDX_appRegVar_applicationRegistrationId" },
  );

  // Unique (key, applicationRegistrationId) pair
  await appRegVar.createIndex(
    { key: 1, applicationRegistrationId: 1 },
    { unique: true, name: "IDX_appRegVar_key_appRegistrationId_unique" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_applicationRegistrationVariable")
    .drop()
    .catch(() => {});

  await db
    .collection("sabcrm_applicationRegistration")
    .drop()
    .catch(() => {});

  // Remove the applicationRegistrationId field from application docs
  await db
    .collection("sabcrm_application")
    .updateMany({}, { $unset: { applicationRegistrationId: "" } });
}
