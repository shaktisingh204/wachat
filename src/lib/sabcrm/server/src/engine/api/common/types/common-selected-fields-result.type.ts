import { type AggregationField } from '@/lib/sabcrm/server/src/engine/api/graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util';

export interface CommonSelectedFields {
  [key: string]: boolean | CommonSelectedFields;
}

export type CommonSelectedFieldsResult = {
  select: CommonSelectedFields;
  relations: CommonSelectedFields;
  aggregate: Record<string, AggregationField>;
  relationFieldsCount?: number;
  hasAtLeastTwoNestedOneToManyRelations?: boolean;
};
