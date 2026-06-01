import "server-only";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that added a
// `metadata` jsonb column to the `billingPrice` table in the `core` schema.
// SabNode uses MongoDB — there is no SQL DDL to run. The equivalent change
// (adding a `metadata` field to documents in the sabcrm_billingprice
// collection) is handled automatically by MongoDB's schemaless model; no
// migration script is required. The original SQL was:
//   ALTER TABLE "core"."billingPrice" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'

export const VERSION = '2.4.0';
export const TIMESTAMP = 1777100000000;

export type AddMetadataToBillingPriceCommand = {
  version: string;
  timestamp: number;
  description: string;
};

export const addMetadataToBillingPriceCommand: AddMetadataToBillingPriceCommand =
  {
    version: VERSION,
    timestamp: TIMESTAMP,
    description:
      'Add metadata field to billingPrice documents (no-op in MongoDB: field added on write)',
  };

export async function up(): Promise<void> {
  // No-op: MongoDB is schemaless; `metadata` field is added on first write.
}

export async function down(): Promise<void> {
  // No-op: Removing a field from MongoDB documents requires an explicit
  // $unset migration. Not ported here as the original command targets Postgres.
}
