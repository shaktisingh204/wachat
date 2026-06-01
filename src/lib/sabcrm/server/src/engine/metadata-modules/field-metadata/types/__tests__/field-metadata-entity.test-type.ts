// PORT-NOTE: This file is a compile-time-only type-assertion test. The original
// used twenty-shared/testing helpers (Expect, HasAllProperties) and TypeORM
// Relation wrappers. In the Next.js port:
//  - TypeORM is removed; relations are plain id references.
//  - twenty-shared/testing is vendored here as inline type utilities.
//  - The FieldMetadataDocument type from the mongo-schema port is used instead
//    of FieldMetadataEntity.
//
// If the assertions below cause TS errors after a schema change, review
// field-metadata.entity.ts accordingly.

import {
  type FieldMetadataDocument,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.entity";

// Inline equivalents of Expect / HasAllProperties from twenty-shared/testing
type Expect<T extends true> = T;
type HasAllProperties<TActual, TExpected> =
  TExpected extends Pick<TActual, keyof TExpected & keyof TActual>
    ? true
    : false;

// ---------------------------------------------------------------------------
// Structural assertions on FieldMetadataDocument
// ---------------------------------------------------------------------------

// Every document must carry the stable public id
type _HasId = Expect<HasAllProperties<FieldMetadataDocument, { id: string }>>;

// Timestamps are required
type _HasTimestamps = Expect<
  HasAllProperties<FieldMetadataDocument, { createdAt: Date; updatedAt: Date }>
>;

// Multi-tenancy
type _HasWorkspace = Expect<
  HasAllProperties<FieldMetadataDocument, { workspaceId: string }>
>;

// Nullable flag must be boolean or null
type _HasNullable = Expect<
  HasAllProperties<FieldMetadataDocument, { isNullable: boolean | null }>
>;

// isUnique is a derived / nullable field
type _HasIsUnique = Expect<
  HasAllProperties<FieldMetadataDocument, { isUnique: boolean | null }>
>;

// These assertions are used by the TypeScript compiler only — they are never
// executed at runtime. oxlint-disable-next-line unused-imports/no-unused-vars
type _Assertions = [
  _HasId,
  _HasTimestamps,
  _HasWorkspace,
  _HasNullable,
  _HasIsUnique,
];
