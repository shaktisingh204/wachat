import "server-only";

// PORT-NOTE: This utility originally relied on TypeORM QueryRunner for Postgres index management
// and a WorkspaceSchemaManagerService that wraps Postgres DDL (CREATE/DROP INDEX).
// In MongoDB there are no SQL indexes; instead use createIndex() on a collection.
// The functions below are ported as logic stubs that document their Mongo analogues.
// `deleteIndexMetadata` and the schema-level helpers have no direct Mongo DDL equivalent
// — callers should use MongoDB's db.collection.createIndex() / dropIndex() APIs directly.

import { compositeTypeDefinitions, RelationType } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { computeMorphOrRelationFieldJoinColumnName } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/compute-morph-or-relation-field-join-column-name.util";
import { computeCompositeColumnName } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/compute-column-name.util";
import { isCompositeFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/is-composite-field-metadata-type.util";
import {
  FlatEntityMapsException,
  FlatEntityMapsExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/exceptions/flat-entity-maps.exception";
import { type MetadataFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { isMorphOrRelationFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/is-morph-or-relation-flat-field-metadata.util";
import {
  type FlatIndexFieldMetadata,
  type FlatIndexMetadata,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type";

// PORT-NOTE: WorkspaceSchemaManagerService is a Postgres DDL abstraction with no Mongo equivalent.
// Schema-level index operations are represented here as typed stubs.
export type WorkspaceSchemaManagerServiceStub = {
  indexManager: {
    createIndex: (args: {
      index: {
        columns: string[];
        name: string;
        isUnique: boolean;
        type: string | undefined;
        where?: string;
      };
      schemaName: string;
      tableName: string;
      concurrently?: boolean;
    }) => Promise<void>;
    dropIndex: (args: {
      indexName: string;
      schemaName: string;
    }) => Promise<void>;
  };
};

export const computeFlatIndexFieldColumnNames = ({
  flatIndexFieldMetadatas,
  flatFieldMetadataMaps,
}: {
  flatIndexFieldMetadatas: FlatIndexFieldMetadata[];
  flatFieldMetadataMaps: MetadataFlatEntityMaps<"fieldMetadata">;
}): string[] => {
  return flatIndexFieldMetadatas.flatMap(
    ({ fieldMetadataId, subFieldName }) => {
      const flatFieldMetadata = findFlatEntityByIdInFlatEntityMapsOrThrow({
        flatEntityId: fieldMetadataId,
        flatEntityMaps: flatFieldMetadataMaps,
      });

      if (!isDefined(flatFieldMetadata)) {
        throw new FlatEntityMapsException(
          "Index field related field metadata not found",
          FlatEntityMapsExceptionCode.ENTITY_NOT_FOUND,
        );
      }

      if (isMorphOrRelationFlatFieldMetadata(flatFieldMetadata)) {
        if (
          flatFieldMetadata.settings?.relationType !== RelationType.MANY_TO_ONE
        ) {
          throw new FlatEntityMapsException(
            "Cannot index a relation field that has no join column",
            FlatEntityMapsExceptionCode.ENTITY_NOT_FOUND,
          );
        }

        return computeMorphOrRelationFieldJoinColumnName({
          name: flatFieldMetadata.name,
        });
      }

      if (isCompositeFieldMetadataType(flatFieldMetadata.type)) {
        const compositeType = compositeTypeDefinitions.get(
          flatFieldMetadata.type,
        );

        if (!compositeType) {
          throw new FlatEntityMapsException(
            "Composite type not found",
            FlatEntityMapsExceptionCode.INTERNAL_SERVER_ERROR,
          );
        }

        if (isDefined(subFieldName)) {
          const property = compositeType.properties.find(
            (compositeProperty) => compositeProperty.name === subFieldName,
          );

          if (!isDefined(property)) {
            throw new FlatEntityMapsException(
              `Composite sub-field "${subFieldName}" not found on ${flatFieldMetadata.name}`,
              FlatEntityMapsExceptionCode.ENTITY_NOT_FOUND,
            );
          }

          return [
            computeCompositeColumnName(
              { name: flatFieldMetadata.name, type: flatFieldMetadata.type },
              property,
            ),
          ];
        }

        // System indexes (no subFieldName) project the composite parent onto
        // every property flagged isIncludedInUniqueConstraint.
        const uniqueCompositeProperties = compositeType.properties.filter(
          (property) => property.isIncludedInUniqueConstraint,
        );

        return uniqueCompositeProperties.map((subField) =>
          computeCompositeColumnName(flatFieldMetadata.name, subField),
        );
      }

      return flatFieldMetadata.name;
    },
  );
};

// PORT-NOTE: deleteIndexMetadata originally deleted from a Postgres `indexMetadata` table
// via TypeORM QueryRunner. In Mongo the equivalent is deleting from the
// `sabcrm_indexMetadata` collection.
export const deleteIndexMetadata = async ({
  entityId,
  workspaceId,
}: {
  entityId: string;
  workspaceId: string;
}): Promise<void> => {
  const { connectToDatabase } = await import("@/lib/mongodb");
  const db = await connectToDatabase();
  await db
    .collection("sabcrm_indexMetadata")
    .deleteOne({ id: entityId, workspaceId });
};

// PORT-NOTE: createIndexInWorkspaceSchema / dropIndexFromWorkspaceSchema manipulate Postgres
// schema DDL and have no direct Mongo equivalent. In Mongo, use
// db.collection.createIndex() / dropIndex() on the target collection.
// These stubs preserve the function signatures for call-site compatibility.
export const createIndexInWorkspaceSchema = async ({
  flatIndexMetadata,
  flatObjectMetadata: _flatObjectMetadata,
  flatFieldMetadataMaps: _flatFieldMetadataMaps,
}: {
  flatIndexMetadata: FlatIndexMetadata;
  flatObjectMetadata: FlatObjectMetadata;
  flatFieldMetadataMaps: MetadataFlatEntityMaps<"fieldMetadata">;
  workspaceSchemaManagerService: WorkspaceSchemaManagerServiceStub;
  workspaceId: string;
  concurrently?: boolean;
}): Promise<void> => {
  // PORT-NOTE: No Mongo DDL equivalent for Postgres schema index creation.
  // Callers should use MongoDB createIndex() on the relevant collection.
  void flatIndexMetadata;
};

export const dropIndexFromWorkspaceSchema = async ({
  indexName: _indexName,
}: {
  indexName: string;
  workspaceSchemaManagerService: WorkspaceSchemaManagerServiceStub;
  schemaName: string;
}): Promise<void> => {
  // PORT-NOTE: No Mongo DDL equivalent for Postgres schema index drop.
  // Callers should use MongoDB dropIndex() on the relevant collection.
};
