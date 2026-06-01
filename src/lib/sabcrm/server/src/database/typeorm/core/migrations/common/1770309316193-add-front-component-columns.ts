// PORT-NOTE: Postgres DDL migration — adds five columns to "core"."frontComponent".
// In MongoDB (sabcrm_frontcomponent) these become new required/optional fields
// on the document type. No structural migration is needed (schemaless).
//
// Original Twenty migration: AddFrontComponentColumns1770309316193
//   UP:
//     ADD "description"           character varying  (nullable)
//     ADD "sourceComponentPath"   character varying  NOT NULL
//     ADD "builtComponentPath"    character varying  NOT NULL
//     ADD "componentName"         character varying  NOT NULL
//     ADD "builtComponentChecksum" character varying NOT NULL
//   DOWN: drops all five columns
//
// Backfill for existing documents — set placeholder values on any records
// created before this migration (run once if collection is not empty):
//   db.sabcrm_frontcomponent.updateMany(
//     { sourceComponentPath: { $exists: false } },
//     { $set: {
//         sourceComponentPath: "",
//         builtComponentPath: "",
//         componentName: "",
//         builtComponentChecksum: ""
//     }}
//   )
//
// The TypeScript document type for FrontComponent should include:
//   description?:           string | null
//   sourceComponentPath:    string
//   builtComponentPath:     string
//   componentName:          string
//   builtComponentChecksum: string

export const migrationNote = {
  id: '1770309316193',
  name: 'AddFrontComponentColumns',
  mongoAction: 'field-add',
  collections: ['sabcrm_frontcomponent'],
  fieldsAdded: [
    { name: 'description', type: 'string | null', default: null },
    { name: 'sourceComponentPath', type: 'string', required: true },
    { name: 'builtComponentPath', type: 'string', required: true },
    { name: 'componentName', type: 'string', required: true },
    { name: 'builtComponentChecksum', type: 'string', required: true },
  ],
} as const;
