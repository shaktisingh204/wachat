import "server-only";

import {
  FieldMetadataType,
  compositeTypeDefinitions,
} from "@/lib/sabcrm/shared/types";
import { capitalize, isDefined } from "@/lib/sabcrm/shared/utils";

import { computeMorphOrRelationFieldJoinColumnName } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/compute-morph-or-relation-field-join-column-name.util";
import { GraphqlQuerySelectedFieldsAggregateParser } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields-aggregate.parser";
import { GraphqlQuerySelectedFieldsRelationParser } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields-relation.parser";
import { type CompositeFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/types/composite-field-metadata-type.type";
import { isCompositeFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/is-composite-field-metadata-type.util";
import { type FlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { type FlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type";
import { isFlatFieldMetadataOfType } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/is-flat-field-metadata-of-type.util";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";

export type GraphqlQuerySelectedFieldsResult = {
  select: Record<string, unknown>;
  relations: Record<string, unknown>;
  aggregate: Record<string, unknown>;
  relationFieldsCount: number;
  hasAtLeastTwoNestedOneToManyRelations: boolean;
};

export class GraphqlQuerySelectedFieldsParser {
  private graphqlQuerySelectedFieldsRelationParser: GraphqlQuerySelectedFieldsRelationParser;
  private aggregateParser: GraphqlQuerySelectedFieldsAggregateParser;
  private flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  private flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;

  constructor(
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>,
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
  ) {
    this.flatObjectMetadataMaps = flatObjectMetadataMaps;
    this.flatFieldMetadataMaps = flatFieldMetadataMaps;
    this.graphqlQuerySelectedFieldsRelationParser =
      new GraphqlQuerySelectedFieldsRelationParser(
        flatObjectMetadataMaps,
        flatFieldMetadataMaps,
      );
    this.aggregateParser = new GraphqlQuerySelectedFieldsAggregateParser();
  }

  parse(
    graphqlSelectedFields: Partial<Record<string, unknown>>,
    flatObjectMetadata: FlatObjectMetadata,
    isFromOneToManyRelation?: boolean,
  ): GraphqlQuerySelectedFieldsResult {
    const accumulator: GraphqlQuerySelectedFieldsResult = {
      select: {},
      relations: {},
      aggregate: {},
      relationFieldsCount: 0,
      hasAtLeastTwoNestedOneToManyRelations: false,
    };

    if (this.isRootConnection(graphqlSelectedFields)) {
      this.parseConnectionField(
        graphqlSelectedFields,
        flatObjectMetadata,
        accumulator,
        isFromOneToManyRelation,
      );

      return accumulator;
    }

    this.aggregateParser.parse(
      graphqlSelectedFields,
      flatObjectMetadata,
      this.flatFieldMetadataMaps,
      accumulator,
    );

    this.parseRecordFields(
      graphqlSelectedFields,
      flatObjectMetadata,
      accumulator,
      isFromOneToManyRelation,
    );

    return accumulator;
  }

  private parseRecordFields(
    graphqlSelectedFields: Partial<Record<string, unknown>>,
    flatObjectMetadata: FlatObjectMetadata,
    accumulator: GraphqlQuerySelectedFieldsResult,
    isFromOneToManyRelation?: boolean,
  ): void {
    for (const fieldMetadataId of flatObjectMetadata.fieldIds) {
      const fieldMetadata = findFlatEntityByIdInFlatEntityMapsOrThrow({
        flatEntityId: fieldMetadataId,
        flatEntityMaps: this.flatFieldMetadataMaps,
      });

      if (
        isFlatFieldMetadataOfType(fieldMetadata, FieldMetadataType.RELATION)
      ) {
        const joinColumnName = computeMorphOrRelationFieldJoinColumnName({
          name: fieldMetadata.name,
        });

        if (isDefined(graphqlSelectedFields[joinColumnName])) {
          accumulator.select[joinColumnName] = true;
        }

        const graphqlSelectedFieldValue =
          graphqlSelectedFields[fieldMetadata.name];

        if (!isDefined(graphqlSelectedFieldValue)) {
          continue;
        }

        this.graphqlQuerySelectedFieldsRelationParser.parseRelationField(
          fieldMetadata,
          fieldMetadata.name,
          graphqlSelectedFieldValue,
          accumulator,
          isFromOneToManyRelation,
        );

        continue;
      }

      if (
        isFlatFieldMetadataOfType(
          fieldMetadata,
          FieldMetadataType.MORPH_RELATION,
        )
      ) {
        const targetObjectMetadata = findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: fieldMetadata.relationTargetObjectMetadataId,
          flatEntityMaps: this.flatObjectMetadataMaps,
        });

        if (
          !fieldMetadata.settings?.relationType ||
          !isDefined(targetObjectMetadata)
        ) {
          continue;
        }

        const joinColumnName = computeMorphOrRelationFieldJoinColumnName({
          name: fieldMetadata.name,
        });

        if (isDefined(graphqlSelectedFields[joinColumnName])) {
          accumulator.select[joinColumnName] = true;
        }

        const graphqlSelectedFieldValue =
          graphqlSelectedFields[fieldMetadata.name];

        if (!isDefined(graphqlSelectedFieldValue)) {
          continue;
        }

        this.graphqlQuerySelectedFieldsRelationParser.parseRelationField(
          fieldMetadata,
          fieldMetadata.name,
          graphqlSelectedFieldValue,
          accumulator,
          isFromOneToManyRelation,
        );

        continue;
      }

      if (isCompositeFieldMetadataType(fieldMetadata.type)) {
        const graphqlSelectedFieldValue =
          graphqlSelectedFields[fieldMetadata.name];

        if (!isDefined(graphqlSelectedFieldValue)) {
          continue;
        }

        const compositeResult = this.parseCompositeField(
          fieldMetadata,
          graphqlSelectedFieldValue,
        );

        Object.assign(accumulator.select, compositeResult);

        continue;
      }

      const graphqlSelectedFieldValue =
        graphqlSelectedFields[fieldMetadata.name];

      if (isDefined(graphqlSelectedFieldValue)) {
        accumulator.select[fieldMetadata.name] = true;
      }
    }
  }

  private parseConnectionField(
    graphqlSelectedFields: Partial<Record<string, unknown>>,
    flatObjectMetadata: FlatObjectMetadata,
    accumulator: GraphqlQuerySelectedFieldsResult,
    isFromOneToManyRelation?: boolean,
  ): void {
    this.aggregateParser.parse(
      graphqlSelectedFields,
      flatObjectMetadata,
      this.flatFieldMetadataMaps,
      accumulator,
    );

    const edges = graphqlSelectedFields.edges as { node?: unknown } | undefined;
    const node = edges?.node as Partial<Record<string, unknown>> | undefined;

    if (node) {
      this.parseRecordFields(
        node,
        flatObjectMetadata,
        accumulator,
        isFromOneToManyRelation,
      );
    }
  }

  private isRootConnection(
    graphqlSelectedFields: Partial<Record<string, unknown>>,
  ): boolean {
    return Object.keys(graphqlSelectedFields).includes("edges");
  }

  private parseCompositeField(
    fieldMetadata: FlatFieldMetadata,
    fieldValue: unknown,
  ): Record<string, unknown> {
    const compositeType = compositeTypeDefinitions.get(
      fieldMetadata.type as CompositeFieldMetadataType,
    );

    if (!compositeType) {
      throw new Error(
        `Composite type definition not found for type: ${fieldMetadata.type}`,
      );
    }

    return Object.keys(fieldValue as Record<string, unknown>)
      .filter((subFieldKey) => subFieldKey !== "__typename")
      .reduce(
        (acc, subFieldKey) => {
          const subFieldMetadata = compositeType.properties.find(
            (property) => property.name === subFieldKey,
          );

          if (!subFieldMetadata) {
            throw new Error(
              `Sub field metadata not found for composite type: ${fieldMetadata.type}`,
            );
          }

          const fullFieldName = `${fieldMetadata.name}${capitalize(subFieldKey)}`;

          acc[fullFieldName] = true;

          return acc;
        },
        {} as Record<string, unknown>,
      );
  }
}
