// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ADD COLUMN "mainGroupByFieldMetadataId" uuid to "core"."view"
//           + FK to "core"."fieldMetadata"("id") ON DELETE CASCADE
//
// Mongo analogue:
//   - The sabcrm_view collection gains an optional field `mainGroupByFieldMetadataId`
//     (stored as a string UUID reference to a document in sabcrm_fieldMetadata).
//   - FK cascade is not enforced at the DB level in Mongo; application code must
//     handle deletion propagation (set to null or remove referencing docs).
//   - No index is created here because the original migration only added a FK
//     constraint, not a standalone index. Add a sparse index below if query
//     patterns require it.
//
// Index creation (run once against your Mongo instance if needed):
//   db.sabcrm_view.createIndex(
//     { mainGroupByFieldMetadataId: 1 },
//     { sparse: true, name: 'IDX_view_mainGroupByFieldMetadataId' }
//   );

export const migration1764680275312 = {
  name: 'AddMainGroupByFieldMetadataId1764680275312',
  description:
    'Adds optional mainGroupByFieldMetadataId reference field to sabcrm_view documents. ' +
    'In Mongo this is a sparse index on the field; FK cascade must be handled by the application.',
  mongoIndexes: [
    {
      collection: 'sabcrm_view',
      index: { mainGroupByFieldMetadataId: 1 },
      options: { sparse: true, name: 'IDX_view_mainGroupByFieldMetadataId' },
    },
  ],
  up: async (): Promise<void> => {
    // Mongo documents are schema-less; the field will be present once the
    // application starts writing it. Create the sparse index if desired.
  },
  down: async (): Promise<void> => {
    // Drop the sparse index and stop writing the field from application code.
  },
} as const;
