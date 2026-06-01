// PORT-NOTE: Postgres DDL migration — adds columns to "core"."logicFunctionLayer"
// and renames an existing column.
// In MongoDB these translate to new optional fields on sabcrm_logicfunctionlayer
// documents. No structural migration is required (schemaless); defaults and
// field renames should be applied at the application layer.
//
// Original Twenty migration: AddDependencyChecksumsToLogicFunctionLayer1770038963629
//   UP:
//     ALTER TABLE "core"."logicFunctionLayer" ADD "packageJsonChecksum" text
//     ALTER TABLE "core"."logicFunctionLayer" RENAME COLUMN "checksum" TO "yarnLockChecksum"
//     ALTER TABLE "core"."logicFunctionLayer" ADD "availablePackages" jsonb NOT NULL DEFAULT '{}'
//   DOWN:
//     ALTER TABLE "core"."logicFunctionLayer" DROP COLUMN "availablePackages"
//     ALTER TABLE "core"."logicFunctionLayer" RENAME COLUMN "yarnLockChecksum" TO "checksum"
//     ALTER TABLE "core"."logicFunctionLayer" DROP COLUMN "packageJsonChecksum"
//
// Mongo field-rename data migration (run once):
//   db.sabcrm_logicfunctionlayer.updateMany(
//     { checksum: { $exists: true } },
//     [{ $set: { yarnLockChecksum: "$checksum" } }, { $unset: "checksum" }]
//   )
//
// New fields added to the LogicFunctionLayer document type:
//   packageJsonChecksum?: string
//   yarnLockChecksum?: string   (renamed from checksum)
//   availablePackages: Record<string, string>  (default {})

export const migrationNote = {
  id: '1770038963629',
  name: 'AddDependencyChecksumsToLogicFunctionLayer',
  mongoAction: 'field-add + field-rename',
  collections: ['sabcrm_logicfunctionlayer'],
  fieldsAdded: [
    { name: 'packageJsonChecksum', type: 'string | null', default: null },
    { name: 'availablePackages', type: 'Record<string,string>', default: {} },
  ],
  fieldRenamed: { from: 'checksum', to: 'yarnLockChecksum' },
  dataCleanup: `db.sabcrm_logicfunctionlayer.updateMany(
    { checksum: { $exists: true } },
    [{ $set: { yarnLockChecksum: "$checksum" } }, { $unset: "checksum" }]
  )`,
} as const;
