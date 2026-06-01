import "server-only";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that altered the
// `messageChannel_type_enum` PostgreSQL ENUM type in the `core` schema to add
// the `EMAIL_GROUP` variant alongside `EMAIL` and `SMS`. In MongoDB there are
// no SQL ENUM types — channel type is stored as a plain string field. The
// equivalent change is to update any application-level validation or Zod
// schemas that gate the allowed values. See the corresponding Zod schema port
// for the messageChannel collection.
//
// Original SQL:
//   ALTER TYPE "core"."messageChannel_type_enum" RENAME TO "messageChannel_type_enum_old"
//   CREATE TYPE "core"."messageChannel_type_enum" AS ENUM('EMAIL', 'SMS', 'EMAIL_GROUP')
//   ALTER TABLE "core"."messageChannel" ALTER COLUMN "type" TYPE ...
//   DROP TYPE "core"."messageChannel_type_enum_old"

export const VERSION = '2.4.0';
export const TIMESTAMP = 1778256809018;

export type MessageChannelType = 'EMAIL' | 'SMS' | 'EMAIL_GROUP';

export const MESSAGE_CHANNEL_TYPES: MessageChannelType[] = [
  'EMAIL',
  'SMS',
  'EMAIL_GROUP',
];

export async function up(): Promise<void> {
  // No-op in MongoDB: the `type` field on messageChannel documents is a string.
  // Existing documents remain valid; new documents can use 'EMAIL_GROUP'.
}

export async function down(): Promise<void> {
  // No-op: would require scanning and rejecting 'EMAIL_GROUP' values.
}
