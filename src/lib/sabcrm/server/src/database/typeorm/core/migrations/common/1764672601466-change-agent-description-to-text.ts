// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."agent" ALTER COLUMN "description" TYPE text
//
// Mongo analogue: The "agent" collection stores `description` as a string field.
// In MongoDB there is no distinction between varchar and text — both are BSON string.
// No index or seed change is required; the field is already effectively unbounded.
//
// If you need to enforce a schema validation rule on the collection, use:
//   db.runCommand({ collMod: "sabcrm_agent", validator: { $jsonSchema: { ... } } })
// but that is optional and not strictly necessary for this change.

export const migration1764672601466 = {
  name: 'ChangeAgentDescriptionToText1764672601466',
  description:
    'No-op in Mongo: description field on sabcrm_agent collection is already an unbounded string. ' +
    'Original PG migration changed column type from varchar to text.',
  up: async (): Promise<void> => {
    // No Mongo index or seed action required.
  },
  down: async (): Promise<void> => {
    // No Mongo index or seed action required.
  },
} as const;
