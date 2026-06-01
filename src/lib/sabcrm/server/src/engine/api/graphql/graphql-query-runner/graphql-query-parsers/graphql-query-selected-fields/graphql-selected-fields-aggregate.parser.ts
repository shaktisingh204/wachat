import "server-only";

import { isDefined } from "@/lib/sabcrm/shared/utils";

import { type GraphqlQuerySelectedFieldsResult } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields.parser";
import {
  type AggregationField,
  getAvailableAggregationsFromObjectFields,
} from "@/lib/sabcrm/server/src/engine/api/graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util";
import { type FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { type FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";

export class GraphqlQuerySelectedFieldsAggregateParser {
  parse(
    graphqlSelectedFields: Partial<Record<string, unknown>>,
    flatObjectMetadata: FlatObjectMetadata,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
    accumulator: GraphqlQuerySelectedFieldsResult,
  ): void {
    const fields = flatObjectMetadata.fieldIds
      .map((id) =>
        findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: id,
          flatEntityMaps: flatFieldMetadataMaps,
        }),
      )
      .filter(isDefined);

    const availableAggregations: Record<string, AggregationField> =
      getAvailableAggregationsFromObjectFields(fields);

    for (const selectedField of Object.keys(graphqlSelectedFields)) {
      const selectedAggregation = availableAggregations[selectedField];

      if (!selectedAggregation) {
        continue;
      }

      accumulator.aggregate[selectedField] = selectedAggregation;
    }
  }
}
