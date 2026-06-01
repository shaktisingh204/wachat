import "server-only";

// PORT-NOTE: NestJS @Injectable() DI is replaced by a plain factory function
// `createLoaders()` that accepts its dependencies explicitly. Instantiate once
// per request (e.g., in React cache or middleware context) and pass around.
// The `dataloader` npm package must be installed.

import DataLoader from "dataloader";
import { FieldMetadataType } from "@/lib/sabcrm/shared/types/field-metadata-type.enum";
import { isDefined } from "@/lib/sabcrm/shared/utils/is-defined.util";

import { type IndexMetadataInterface } from "@/lib/sabcrm/server/src/engine/metadata-modules/index-metadata/interfaces/index-metadata.interface";

import { type IDataloaders } from "@/lib/sabcrm/server/src/engine/dataloaders/dataloader.interface";
import { filterMorphRelationDuplicateFields } from "@/lib/sabcrm/server/src/engine/dataloaders/utils/filter-morph-relation-duplicate-fields.util";
import { type FieldMetadataDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/field-metadata.dto";
import { RelationDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/relation.dto";
import { type FieldMetadataEntity } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.entity";
import { resolveFieldMetadataStandardOverride } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/resolve-field-metadata-standard-override.util";
import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { findManyFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-many-flat-entity-by-id-in-flat-entity-maps.util";
import { findManyFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-many-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { fromFlatFieldMetadataToFieldMetadataDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/from-flat-field-metadata-to-field-metadata-dto.util";
import { isFlatFieldMetadataOfType } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/is-flat-field-metadata-of-type.util";
import { resolveMorphRelationsFromFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/resolve-morph-relations-from-flat-field-metadata.util";
import { resolveRelationFromFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/resolve-relation-from-flat-field-metadata.util";
import { fromFlatObjectMetadataToObjectMetadataDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/utils/from-flat-object-metadata-to-object-metadata-dto.util";
import { getMorphNameFromMorphFieldMetadataName } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/utils/get-morph-name-from-morph-field-metadata-name.util";
import { fromFlatViewFieldGroupToViewFieldGroupDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-field-group/utils/from-flat-view-field-group-to-view-field-group-dto.util";
import { fromFlatViewFieldToViewFieldDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-field/utils/from-flat-view-field-to-view-field-dto.util";
import { fromFlatViewFilterToViewFilterDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-filter/utils/from-flat-view-filter-to-view-filter-dto.util";
import { fromFlatViewFilterGroupToViewFilterGroupDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-filter-group/utils/from-flat-view-filter-group-to-view-filter-group-dto.util";
import { fromFlatViewGroupToViewGroupDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-group/utils/from-flat-view-group-to-view-group-dto.util";
import { fromFlatViewSortToViewSortDto } from "@/lib/sabcrm/server/src/engine/metadata-modules/view-sort/utils/from-flat-view-sort-to-view-sort-dto.util";
import { type IndexFieldMetadataDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/index-metadata/dtos/index-field-metadata.dto";
import { type IndexMetadataDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/index-metadata/dtos/index-metadata.dto";
import { ObjectMetadataDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/object-metadata/dtos/object-metadata.dto";
import { type ObjectMetadataEntity } from "@/lib/sabcrm/server/src/engine/metadata-modules/object-metadata/object-metadata.entity";
import { FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/constants/field-metadata-standard-overrides-properties.constant";

// ---------------------------------------------------------------------------
// Payload types (re-exported so consumers can use them without importing service)
// ---------------------------------------------------------------------------

export type RelationMetadataLoaderPayload = {
  workspaceId: string;
  fieldMetadata: Pick<FieldMetadataEntity, "type" | "id" | "objectMetadataId">;
};

export type RelationLoaderPayload = {
  workspaceId: string;
  fieldMetadataId: string;
  objectMetadataId: string;
};

export type MorphRelationLoaderPayload = {
  workspaceId: string;
  fieldMetadataId: string;
  objectMetadataId: string;
};

export type FieldMetadataLoaderPayload = {
  workspaceId: string;
  objectMetadata: Pick<ObjectMetadataEntity, "id">;
  locale?: string;
};

export type IndexMetadataLoaderPayload = {
  workspaceId: string;
  objectMetadata: Pick<ObjectMetadataEntity, "id">;
};

export type IndexFieldMetadataLoaderPayload = {
  workspaceId: string;
  objectMetadata: Pick<ObjectMetadataEntity, "id">;
  indexMetadata: Pick<IndexMetadataInterface, "id">;
};

export type ObjectMetadataLoaderPayload = {
  workspaceId: string;
  objectMetadataId: string;
};

export type ViewFieldGroupsByViewIdLoaderPayload = {
  workspaceId: string;
  viewId: string;
};

export type ViewFieldsByViewFieldGroupIdLoaderPayload = {
  workspaceId: string;
  viewFieldGroupId: string;
};

export type ViewFieldsByViewIdLoaderPayload = {
  workspaceId: string;
  viewId: string;
};

export type ViewFiltersByViewIdLoaderPayload = {
  workspaceId: string;
  viewId: string;
};

export type ViewSortsByViewIdLoaderPayload = {
  workspaceId: string;
  viewId: string;
};

export type ViewGroupsByViewIdLoaderPayload = {
  workspaceId: string;
  viewId: string;
};

export type ViewFilterGroupsByViewIdLoaderPayload = {
  workspaceId: string;
  viewId: string;
};

export type IsConfiguredLoaderPayload = {
  applicationRegistrationId: string;
};

// ---------------------------------------------------------------------------
// Dependency interface
// ---------------------------------------------------------------------------

export interface DataloaderServiceDeps {
  /** Locale-aware i18n instance getter */
  getI18nInstance: (locale: string) => unknown;
  flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService;
  applicationRegistrationVariableService: {
    isConfiguredBatch: (ids: string[]) => Promise<Map<string, boolean>>;
  };
}

// ---------------------------------------------------------------------------
// Factory (replaces the NestJS injectable class)
// ---------------------------------------------------------------------------

export function createLoaders(deps: DataloaderServiceDeps): IDataloaders {
  return {
    relationLoader: createRelationLoader(deps),
    morphRelationLoader: createMorphRelationLoader(deps),
    fieldMetadataLoader: createFieldMetadataLoader(deps),
    indexMetadataLoader: createIndexMetadataLoader(deps),
    indexFieldMetadataLoader: createIndexFieldMetadataLoader(deps),
    objectMetadataLoader: createObjectMetadataLoader(deps),
    viewFieldGroupsByViewIdLoader: createViewFieldGroupsByViewIdLoader(deps),
    viewFieldsByViewFieldGroupIdLoader:
      createViewFieldsByViewFieldGroupIdLoader(deps),
    viewFieldsByViewIdLoader: createViewFieldsByViewIdLoader(deps),
    viewFiltersByViewIdLoader: createViewFiltersByViewIdLoader(deps),
    viewSortsByViewIdLoader: createViewSortsByViewIdLoader(deps),
    viewGroupsByViewIdLoader: createViewGroupsByViewIdLoader(deps),
    viewFilterGroupsByViewIdLoader: createViewFilterGroupsByViewIdLoader(deps),
    isConfiguredLoader: createIsConfiguredLoader(deps),
  };
}

// ---------------------------------------------------------------------------
// Individual loaders
// ---------------------------------------------------------------------------

function createRelationLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<RelationLoaderPayload, RelationDTO | null>(
    async (dataLoaderParams: readonly RelationLoaderPayload[]) => {
      const workspaceId = dataLoaderParams[0].workspaceId;
      const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatFieldMetadataMaps", "flatObjectMetadataMaps"],
          },
        );

      return dataLoaderParams.map(({ fieldMetadataId }) => {
        const sourceFlatFieldMetadata =
          findFlatEntityByIdInFlatEntityMapsOrThrow({
            flatEntityId: fieldMetadataId,
            flatEntityMaps: flatFieldMetadataMaps,
          });

        if (
          !isFlatFieldMetadataOfType(
            sourceFlatFieldMetadata,
            FieldMetadataType.RELATION,
          )
        ) {
          return null;
        }

        return resolveRelationFromFlatFieldMetadata({
          sourceFlatFieldMetadata,
          flatFieldMetadataMaps,
          flatObjectMetadataMaps,
        });
      });
    },
  );
}

function createMorphRelationLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<MorphRelationLoaderPayload, RelationDTO[] | null>(
    async (dataLoaderParams: readonly MorphRelationLoaderPayload[]) => {
      const workspaceId = dataLoaderParams[0].workspaceId;
      const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatFieldMetadataMaps", "flatObjectMetadataMaps"],
          },
        );

      return dataLoaderParams.map(({ fieldMetadataId }) => {
        const morphFlatFieldMetadata =
          findFlatEntityByIdInFlatEntityMapsOrThrow({
            flatEntityId: fieldMetadataId,
            flatEntityMaps: flatFieldMetadataMaps,
          });

        if (
          !isFlatFieldMetadataOfType(
            morphFlatFieldMetadata,
            FieldMetadataType.MORPH_RELATION,
          )
        ) {
          return null;
        }

        return resolveMorphRelationsFromFlatFieldMetadata({
          morphFlatFieldMetadata,
          flatFieldMetadataMaps,
          flatObjectMetadataMaps,
        });
      });
    },
  );
}

function createIndexMetadataLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<IndexMetadataLoaderPayload, IndexMetadataDTO[]>(
    async (dataLoaderParams: readonly IndexMetadataLoaderPayload[]) => {
      const workspaceId = dataLoaderParams[0].workspaceId;
      const objectMetadataIds = dataLoaderParams.map(
        (p) => p.objectMetadata.id,
      );

      const { flatIndexMaps, flatObjectMetadataMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatIndexMaps", "flatObjectMetadataMaps"],
          },
        );

      return objectMetadataIds.map((objectMetadataId) => {
        const flatObjectMetadata = findFlatEntityByIdInFlatEntityMapsOrThrow({
          flatEntityId: objectMetadataId,
          flatEntityMaps: flatObjectMetadataMaps,
        });

        const indexMetadatas = findManyFlatEntityByIdInFlatEntityMapsOrThrow({
          flatEntityIds: flatObjectMetadata.indexMetadataIds,
          flatEntityMaps: flatIndexMaps,
        });

        return indexMetadatas.map((indexMetadata) => ({
          ...indexMetadata,
          indexFieldMetadatas: indexMetadata.flatIndexFieldMetadatas,
          createdAt: new Date(indexMetadata.createdAt),
          updatedAt: new Date(indexMetadata.updatedAt),
          id: indexMetadata.id,
          indexWhereClause: indexMetadata.indexWhereClause ?? undefined,
          objectMetadataId,
          workspaceId,
        }));
      });
    },
  );
}

function createFieldMetadataLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<FieldMetadataLoaderPayload, FieldMetadataDTO[]>(
    async (dataLoaderParams: readonly FieldMetadataLoaderPayload[]) => {
      const locale = dataLoaderParams[0].locale;
      const i18nInstance = deps.getI18nInstance(locale ?? "en");
      const workspaceId = dataLoaderParams[0].workspaceId;
      const objectMetadataIds = dataLoaderParams.map(
        (p) => p.objectMetadata.id,
      );

      const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatFieldMetadataMaps", "flatObjectMetadataMaps"],
          },
        );

      return objectMetadataIds.map((objectMetadataId) => {
        const flatObjectMetadata = findFlatEntityByIdInFlatEntityMapsOrThrow({
          flatEntityId: objectMetadataId,
          flatEntityMaps: flatObjectMetadataMaps,
        });
        const objectFlatFieldMetadatas =
          findManyFlatEntityByIdInFlatEntityMapsOrThrow({
            flatEntityIds: flatObjectMetadata.fieldIds,
            flatEntityMaps: flatFieldMetadataMaps,
          });

        const overriddenFieldMetadataEntities = objectFlatFieldMetadatas.map(
          (flatFieldMetadata) => {
            return FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES.reduce(
              (acc, property) => ({
                ...acc,
                [property]: resolveFieldMetadataStandardOverride(
                  {
                    label: flatFieldMetadata.label,
                    description: flatFieldMetadata.description ?? undefined,
                    icon: flatFieldMetadata.icon ?? undefined,
                    isCustom: flatFieldMetadata.isCustom,
                    standardOverrides:
                      flatFieldMetadata.standardOverrides ?? undefined,
                  },
                  property,
                  dataLoaderParams[0].locale,
                  i18nInstance,
                ),
              }),
              flatFieldMetadata,
            );
          },
        );

        const filteredFieldMetadataEntities =
          filterMorphRelationDuplicateFields(overriddenFieldMetadataEntities);

        const filteredWithMorphRenamed = filteredFieldMetadataEntities.map(
          (flatFieldMetadata) => {
            if (
              isFlatFieldMetadataOfType(
                flatFieldMetadata,
                FieldMetadataType.MORPH_RELATION,
              )
            ) {
              const relationTargetObjectMetadata =
                findFlatEntityByIdInFlatEntityMapsOrThrow({
                  flatEntityId:
                    flatFieldMetadata.relationTargetObjectMetadataId,
                  flatEntityMaps: flatObjectMetadataMaps,
                });

              return {
                ...flatFieldMetadata,
                name: getMorphNameFromMorphFieldMetadataName({
                  morphRelationFlatFieldMetadata: flatFieldMetadata,
                  nameSingular: relationTargetObjectMetadata.nameSingular,
                  namePlural: relationTargetObjectMetadata.namePlural,
                }),
              };
            }

            return flatFieldMetadata;
          },
        );

        return filteredWithMorphRenamed.map(fromFlatFieldMetadataToFieldMetadataDto);
      });
    },
  );
}

function createIndexFieldMetadataLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<IndexFieldMetadataLoaderPayload, IndexFieldMetadataDTO[]>(
    async (dataLoaderParams: readonly IndexFieldMetadataLoaderPayload[]) => {
      const workspaceId = dataLoaderParams[0].workspaceId;

      const { flatIndexMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatIndexMaps"],
          },
        );

      return dataLoaderParams.map(({ indexMetadata: { id: indexMetadataId } }) => {
        const indexMetadataEntity = findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: indexMetadataId,
          flatEntityMaps: flatIndexMaps,
        });

        if (!isDefined(indexMetadataEntity)) {
          return [];
        }

        return [...indexMetadataEntity.flatIndexFieldMetadatas]
          .sort((a, b) => a.order - b.order)
          .map((indexFieldMetadata) => ({
            id: indexFieldMetadata.id,
            fieldMetadataId: indexFieldMetadata.fieldMetadataId,
            subFieldName: indexFieldMetadata.subFieldName ?? undefined,
            order: indexFieldMetadata.order,
            createdAt: new Date(indexFieldMetadata.createdAt),
            updatedAt: new Date(indexFieldMetadata.updatedAt),
            indexMetadataId,
            workspaceId,
          }));
      });
    },
  );
}

function createObjectMetadataLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<ObjectMetadataLoaderPayload, ObjectMetadataDTO | null>(
    async (dataLoaderParams: readonly ObjectMetadataLoaderPayload[]) => {
      const workspaceId = dataLoaderParams[0].workspaceId;

      const { flatObjectMetadataMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatObjectMetadataMaps"],
          },
        );

      return dataLoaderParams.map((param) => {
        const flatObjectMetadata = findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: param.objectMetadataId,
          flatEntityMaps: flatObjectMetadataMaps,
        });

        if (!isDefined(flatObjectMetadata)) {
          return null;
        }

        return fromFlatObjectMetadataToObjectMetadataDto(flatObjectMetadata);
      });
    },
  );
}

function createViewFieldGroupsByViewIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewFieldGroupsByViewIdLoaderPayload,
    ReturnType<typeof fromFlatViewFieldGroupToViewFieldGroupDto>[]
  >(async (dataLoaderParams: readonly ViewFieldGroupsByViewIdLoaderPayload[]) => {
    const workspaceId = dataLoaderParams[0].workspaceId;

    const { flatViewMaps, flatViewFieldGroupMaps } =
      await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ["flatViewMaps", "flatViewFieldGroupMaps"],
        },
      );

    return dataLoaderParams.map(({ viewId }) => {
      const flatView = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: viewId,
        flatEntityMaps: flatViewMaps,
      });

      if (!isDefined(flatView)) {
        return [];
      }

      return findManyFlatEntityByIdInFlatEntityMaps({
        flatEntityIds: flatView.viewFieldGroupIds,
        flatEntityMaps: flatViewFieldGroupMaps,
      })
        .filter(
          (g) => g.deletedAt === null && g.isActive,
        )
        .map(fromFlatViewFieldGroupToViewFieldGroupDto);
    });
  });
}

function createViewFieldsByViewFieldGroupIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewFieldsByViewFieldGroupIdLoaderPayload,
    ReturnType<typeof fromFlatViewFieldToViewFieldDto>[]
  >(
    async (
      dataLoaderParams: readonly ViewFieldsByViewFieldGroupIdLoaderPayload[],
    ) => {
      const workspaceId = dataLoaderParams[0].workspaceId;

      const { flatViewFieldGroupMaps, flatViewFieldMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatViewFieldGroupMaps", "flatViewFieldMaps"],
          },
        );

      const viewFieldsByResolvedGroupId = new Map<
        string,
        ReturnType<typeof fromFlatViewFieldToViewFieldDto>[]
      >();

      for (const flatViewField of Object.values(
        flatViewFieldMaps.byUniversalIdentifier,
      )) {
        if (
          !isDefined(flatViewField) ||
          flatViewField.deletedAt !== null ||
          !flatViewField.isActive
        ) {
          continue;
        }

        const resolvedGroupId =
          flatViewField.overrides?.viewFieldGroupId !== undefined
            ? flatViewField.overrides.viewFieldGroupId
            : flatViewField.viewFieldGroupId;

        if (!isDefined(resolvedGroupId)) {
          continue;
        }

        if (!viewFieldsByResolvedGroupId.has(resolvedGroupId)) {
          viewFieldsByResolvedGroupId.set(resolvedGroupId, []);
        }

        viewFieldsByResolvedGroupId
          .get(resolvedGroupId)!
          .push(fromFlatViewFieldToViewFieldDto(flatViewField));
      }

      return dataLoaderParams.map(({ viewFieldGroupId }) => {
        const flatViewFieldGroup = findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: viewFieldGroupId,
          flatEntityMaps: flatViewFieldGroupMaps,
        });

        if (!isDefined(flatViewFieldGroup)) {
          return [];
        }

        return viewFieldsByResolvedGroupId.get(viewFieldGroupId) ?? [];
      });
    },
  );
}

function createViewFieldsByViewIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewFieldsByViewIdLoaderPayload,
    ReturnType<typeof fromFlatViewFieldToViewFieldDto>[]
  >(async (dataLoaderParams: readonly ViewFieldsByViewIdLoaderPayload[]) => {
    const workspaceId = dataLoaderParams[0].workspaceId;

    const { flatViewMaps, flatViewFieldMaps } =
      await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ["flatViewMaps", "flatViewFieldMaps"],
        },
      );

    return dataLoaderParams.map(({ viewId }) => {
      const flatView = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: viewId,
        flatEntityMaps: flatViewMaps,
      });

      if (!isDefined(flatView)) {
        return [];
      }

      return findManyFlatEntityByIdInFlatEntityMaps({
        flatEntityIds: flatView.viewFieldIds,
        flatEntityMaps: flatViewFieldMaps,
      })
        .filter((f) => f.deletedAt === null && f.isActive)
        .map(fromFlatViewFieldToViewFieldDto);
    });
  });
}

function createViewFiltersByViewIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewFiltersByViewIdLoaderPayload,
    ReturnType<typeof fromFlatViewFilterToViewFilterDto>[]
  >(async (dataLoaderParams: readonly ViewFiltersByViewIdLoaderPayload[]) => {
    const workspaceId = dataLoaderParams[0].workspaceId;

    const { flatViewMaps, flatViewFilterMaps } =
      await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ["flatViewMaps", "flatViewFilterMaps"],
        },
      );

    return dataLoaderParams.map(({ viewId }) => {
      const flatView = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: viewId,
        flatEntityMaps: flatViewMaps,
      });

      if (!isDefined(flatView)) {
        return [];
      }

      return findManyFlatEntityByIdInFlatEntityMaps({
        flatEntityIds: flatView.viewFilterIds,
        flatEntityMaps: flatViewFilterMaps,
      })
        .filter((f) => f.deletedAt === null)
        .map(fromFlatViewFilterToViewFilterDto);
    });
  });
}

function createViewSortsByViewIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewSortsByViewIdLoaderPayload,
    ReturnType<typeof fromFlatViewSortToViewSortDto>[]
  >(async (dataLoaderParams: readonly ViewSortsByViewIdLoaderPayload[]) => {
    const workspaceId = dataLoaderParams[0].workspaceId;

    const { flatViewMaps, flatViewSortMaps } =
      await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ["flatViewMaps", "flatViewSortMaps"],
        },
      );

    return dataLoaderParams.map(({ viewId }) => {
      const flatView = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: viewId,
        flatEntityMaps: flatViewMaps,
      });

      if (!isDefined(flatView)) {
        return [];
      }

      return findManyFlatEntityByIdInFlatEntityMaps({
        flatEntityIds: flatView.viewSortIds,
        flatEntityMaps: flatViewSortMaps,
      })
        .filter((s) => s.deletedAt === null)
        .map(fromFlatViewSortToViewSortDto);
    });
  });
}

function createViewGroupsByViewIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewGroupsByViewIdLoaderPayload,
    ReturnType<typeof fromFlatViewGroupToViewGroupDto>[]
  >(async (dataLoaderParams: readonly ViewGroupsByViewIdLoaderPayload[]) => {
    const workspaceId = dataLoaderParams[0].workspaceId;

    const { flatViewMaps, flatViewGroupMaps } =
      await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ["flatViewMaps", "flatViewGroupMaps"],
        },
      );

    return dataLoaderParams.map(({ viewId }) => {
      const flatView = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: viewId,
        flatEntityMaps: flatViewMaps,
      });

      if (!isDefined(flatView)) {
        return [];
      }

      return findManyFlatEntityByIdInFlatEntityMaps({
        flatEntityIds: flatView.viewGroupIds,
        flatEntityMaps: flatViewGroupMaps,
      })
        .filter((g) => g.deletedAt === null)
        .map(fromFlatViewGroupToViewGroupDto);
    });
  });
}

function createViewFilterGroupsByViewIdLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<
    ViewFilterGroupsByViewIdLoaderPayload,
    ReturnType<typeof fromFlatViewFilterGroupToViewFilterGroupDto>[]
  >(
    async (
      dataLoaderParams: readonly ViewFilterGroupsByViewIdLoaderPayload[],
    ) => {
      const workspaceId = dataLoaderParams[0].workspaceId;

      const { flatViewMaps, flatViewFilterGroupMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ["flatViewMaps", "flatViewFilterGroupMaps"],
          },
        );

      return dataLoaderParams.map(({ viewId }) => {
        const flatView = findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: viewId,
          flatEntityMaps: flatViewMaps,
        });

        if (!isDefined(flatView)) {
          return [];
        }

        return findManyFlatEntityByIdInFlatEntityMaps({
          flatEntityIds: flatView.viewFilterGroupIds,
          flatEntityMaps: flatViewFilterGroupMaps,
        })
          .filter((g) => g.deletedAt === null)
          .map(fromFlatViewFilterGroupToViewFilterGroupDto);
      });
    },
  );
}

function createIsConfiguredLoader(deps: DataloaderServiceDeps) {
  return new DataLoader<IsConfiguredLoaderPayload, boolean>(
    async (params: readonly IsConfiguredLoaderPayload[]) => {
      const ids = params.map((p) => p.applicationRegistrationId);
      const resultMap =
        await deps.applicationRegistrationVariableService.isConfiguredBatch(ids);

      return params.map(
        (p) => resultMap.get(p.applicationRegistrationId) ?? true,
      );
    },
  );
}
