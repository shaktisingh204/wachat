// PORT-NOTE: Ported from twenty-server record-crud-input.type. Filter/OrderBy types
// are intentionally left as open records since the GraphQL types they referenced
// do not have a direct Mongo analogue yet.

export type ObjectRecordProperties = Record<string, unknown>;

export type CreateRecordInput = {
  objectName: string;
  objectRecord: ObjectRecordProperties;
  upsert?: boolean;
};

export type UpdateRecordInput = {
  objectName: string;
  objectRecordId: string;
  objectRecord: ObjectRecordProperties;
  fieldsToUpdate?: string[];
};

export type DeleteRecordInput = {
  objectName: string;
  objectRecordId: string;
};

export type FindRecordsInput = {
  objectName: string;
  filter?: {
    recordFilterGroups?: unknown;
    recordFilters?: unknown;
    gqlOperationFilter?: Record<string, unknown>[];
  };
  orderBy?: {
    recordSorts?: unknown;
    gqlOperationOrderBy?: Record<string, unknown>;
  };
  limit?: number;
};

export type UpsertRecordInput = {
  objectName: string;
  objectRecord: ObjectRecordProperties;
};
