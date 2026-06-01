import "server-only";

// PORT-NOTE: Ported from NestJS Injectable + TypeORM DataSource to plain async
// functions backed by Mongo. TypeORM DataSource/QueryRunner replaced with a
// stub queryRunner object (no Postgres transactions). NestJS DI removed;
// dependencies injected as constructor arguments.
// Cache invalidation stubs call the ported cache service equivalents.
// Behavior and all branching logic preserved faithfully.

import type { AllMetadataName } from '@/lib/sabcrm/shared/src/metadata/types/all-metadata-name';
import type { AllFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type';
import { getMetadataFlatEntityMapsKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-flat-entity-maps-key.util';
import { getMetadataRelatedMetadataNamesForValidation } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-related-metadata-names-for-validation.util';
import { getMetadataRelatedMetadataNames } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-related-metadata-names.util';
import { getMetadataSerializedRelationNames } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-serialized-relation-names.util';
import type { WorkspaceMigration } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/workspace-migration.type';
import {
  WorkspaceMigrationRunnerException,
  WorkspaceMigrationRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/exceptions/workspace-migration-runner.exception';
import { WorkspaceMigrationRunnerActionHandlerRegistryService } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/registry/workspace-migration-runner-action-handler-registry.service';
import type { MetadataEvent } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/metadata-event';

// Minimal logger interface
interface ILogger {
  error(message: string, context?: string): void;
  time(context: string, label: string): void;
  timeEnd(context: string, label: string): void;
}

const defaultLogger: ILogger = {
  error: (msg, ctx) => console.error(`[${ctx ?? ''}] ${msg}`),
  time: (ctx, label) => console.time(`[${ctx}] ${label}`),
  timeEnd: (ctx, label) => console.timeEnd(`[${ctx}] ${label}`),
};

// Minimal interfaces for injected services (callers provide real implementations)
interface FlatEntityMapsCacheService {
  getOrRecomputeManyOrAllFlatEntityMaps<TKeys extends (keyof AllFlatEntityMaps)[]>(args: {
    workspaceId: string;
    flatMapsKeys: TKeys;
  }): Promise<Pick<AllFlatEntityMaps, TKeys[number]>>;
  invalidateFlatEntityMaps(args: {
    workspaceId: string;
    flatMapsKeys: (keyof AllFlatEntityMaps)[];
  }): Promise<void>;
}

interface WorkspaceCacheService {
  getOrRecompute<TKeys extends (keyof WorkspaceCache)[]>(
    workspaceId: string,
    keys: TKeys,
  ): Promise<Pick<WorkspaceCache, TKeys[number]>>;
  invalidateAndRecompute(workspaceId: string, keys: string[]): Promise<void>;
}

// Minimal WorkspaceCache type — callers extend as needed
type WorkspaceCache = {
  flatApplicationMaps: {
    idByUniversalIdentifier: Record<string, string | undefined>;
    byId: Record<string, { id: string; [key: string]: unknown } | undefined>;
  };
  rolesPermissions?: unknown;
  userWorkspaceRoleMap?: unknown;
  flatRoleTargetMaps?: unknown;
  apiKeyRoleMap?: unknown;
  ORMEntityMetadatas?: unknown;
  flatRoleTargetByAgentIdMaps?: unknown;
  graphQLResolverNameMap?: unknown;
  applicationVariableMaps?: unknown;
};

interface WorkspaceCacheStorageService {
  flushGraphQLOperation(args: { operationName: string; workspaceId: string }): Promise<void>;
}

interface WorkspaceMetadataVersionService {
  incrementMetadataVersion(workspaceId: string): Promise<void>;
}

// PORT-NOTE: FIND_ALL_VIEWS_GRAPHQL_OPERATION constant kept inline since the
// ported constant module may not exist yet.
const FIND_ALL_VIEWS_GRAPHQL_OPERATION = 'findAllViews';

// PORT-NOTE: WORKSPACE_SCHEMA_DDL_LOCKED config replaces TwentyConfigService.get().
// Callers should set this from their environment.
let WORKSPACE_SCHEMA_DDL_LOCKED = false;

export const setWorkspaceSchemaDdlLocked = (locked: boolean): void => {
  WORKSPACE_SCHEMA_DDL_LOCKED = locked;
};

export class WorkspaceMigrationRunnerService {
  constructor(
    private readonly flatEntityMapsCacheService: FlatEntityMapsCacheService,
    private readonly workspaceMigrationRunnerActionHandlerRegistry: WorkspaceMigrationRunnerActionHandlerRegistryService,
    private readonly workspaceMetadataVersionService: WorkspaceMetadataVersionService,
    private readonly workspaceCacheStorageService: WorkspaceCacheStorageService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly logger: ILogger = defaultLogger,
  ) {}

  private getLegacyCacheInvalidationPromises({
    allFlatEntityMapsKeys,
    workspaceId,
  }: {
    allFlatEntityMapsKeys: (keyof AllFlatEntityMaps)[];
    workspaceId: string;
  }): Promise<void>[] {
    const asyncOperations: Promise<void>[] = [];
    const flatMapsKeysSet = new Set(allFlatEntityMapsKeys);

    const shouldIncrementMetadataGraphqlSchemaVersion =
      flatMapsKeysSet.has('flatObjectMetadataMaps') ||
      flatMapsKeysSet.has('flatFieldMetadataMaps');

    if (shouldIncrementMetadataGraphqlSchemaVersion) {
      asyncOperations.push(
        this.workspaceMetadataVersionService.incrementMetadataVersion(
          workspaceId,
        ),
      );
    }

    const viewRelatedFlatMapsKeys: (keyof AllFlatEntityMaps)[] = [
      'flatViewMaps',
      'flatViewFilterMaps',
      'flatViewGroupMaps',
      'flatViewFieldMaps',
      'flatViewFilterGroupMaps',
    ];
    const shouldInvalidateFindViewsGraphqlCacheOperation =
      viewRelatedFlatMapsKeys.some((key) => flatMapsKeysSet.has(key));

    if (
      shouldInvalidateFindViewsGraphqlCacheOperation ||
      shouldIncrementMetadataGraphqlSchemaVersion
    ) {
      asyncOperations.push(
        this.workspaceCacheStorageService.flushGraphQLOperation({
          operationName: FIND_ALL_VIEWS_GRAPHQL_OPERATION,
          workspaceId,
        }),
      );
    }

    const shouldInvalidateRoleMapCache =
      flatMapsKeysSet.has('flatRoleMaps') ||
      flatMapsKeysSet.has('flatRoleTargetMaps');

    const shouldInvalidateRolesPermissionsCache =
      flatMapsKeysSet.has('flatObjectPermissionMaps') ||
      flatMapsKeysSet.has('flatFieldPermissionMaps') ||
      flatMapsKeysSet.has('flatRolePermissionFlagMaps');

    if (
      shouldIncrementMetadataGraphqlSchemaVersion ||
      shouldInvalidateRoleMapCache ||
      shouldInvalidateRolesPermissionsCache
    ) {
      asyncOperations.push(
        this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
          'rolesPermissions',
          'userWorkspaceRoleMap',
          'flatRoleTargetMaps',
          'apiKeyRoleMap',
          'ORMEntityMetadatas',
          'flatRoleTargetByAgentIdMaps',
          'graphQLResolverNameMap',
        ]),
      );
    }

    if (flatMapsKeysSet.has('flatApplicationVariableMaps')) {
      asyncOperations.push(
        this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
          'applicationVariableMaps',
        ]),
      );
    }

    return asyncOperations;
  }

  async invalidateCache({
    allFlatEntityMapsKeys,
    workspaceId,
  }: {
    allFlatEntityMapsKeys: (keyof AllFlatEntityMaps)[];
    workspaceId: string;
  }): Promise<void> {
    this.logger.time(
      'Runner',
      `Cache invalidation ${allFlatEntityMapsKeys.join()}`,
    );

    await this.flatEntityMapsCacheService.invalidateFlatEntityMaps({
      workspaceId,
      flatMapsKeys: allFlatEntityMapsKeys,
    });

    const invalidationResults = await Promise.allSettled(
      this.getLegacyCacheInvalidationPromises({
        allFlatEntityMapsKeys,
        workspaceId,
      }),
    );

    const invalidationFailures = invalidationResults.filter(
      (result) => result.status === 'rejected',
    );

    if (invalidationFailures.length > 0) {
      invalidationFailures.forEach((err) =>
        this.logger.error(
          `Failed to invalidate a legacy cache ${(err as PromiseRejectedResult).reason}`,
          'Runner',
        ),
      );
      throw new Error(
        `Failed to invalidate ${invalidationFailures.length} cache operations`,
      );
    }

    this.logger.timeEnd(
      'Runner',
      `Cache invalidation ${allFlatEntityMapsKeys.join()}`,
    );
  }

  run = async ({
    workspaceMigration: { actions, applicationUniversalIdentifier },
    workspaceId,
  }: {
    workspaceMigration: WorkspaceMigration;
    workspaceId: string;
  }): Promise<{
    allFlatEntityMaps: AllFlatEntityMaps;
    metadataEvents: MetadataEvent[];
    hasSchemaMetadataChanged: boolean;
  }> => {
    if (WORKSPACE_SCHEMA_DDL_LOCKED) {
      throw new WorkspaceMigrationRunnerException({
        message:
          'Workspace schema DDL changes are locked. This is typically set during hot upgrades.',
        code: WorkspaceMigrationRunnerExceptionCode.DDL_LOCKED,
      });
    }

    this.logger.time('Runner', 'Total execution');
    this.logger.time('Runner', 'Initial cache retrieval');

    const actionMetadataNames = [
      ...new Set(actions.flatMap((action) => action.metadataName)),
    ] as AllMetadataName[];

    const actionsMetadataAndRelatedMetadataNames: AllMetadataName[] = [
      ...new Set([
        ...actionMetadataNames,
        ...actionMetadataNames.flatMap(getMetadataRelatedMetadataNames),
        ...actionMetadataNames.flatMap(getMetadataSerializedRelationNames),
        ...actionMetadataNames.flatMap(
          getMetadataRelatedMetadataNamesForValidation,
        ),
      ]),
    ];

    const allFlatEntityMapsKeys = actionsMetadataAndRelatedMetadataNames.map(
      getMetadataFlatEntityMapsKey,
    );

    let allFlatEntityMaps =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps<
        typeof allFlatEntityMapsKeys
      >({
        workspaceId,
        flatMapsKeys: allFlatEntityMapsKeys,
      });

    this.logger.timeEnd('Runner', 'Initial cache retrieval');

    const { flatApplicationMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatApplicationMaps',
      ]);

    const applicationId =
      flatApplicationMaps.idByUniversalIdentifier[
        applicationUniversalIdentifier
      ];
    const flatApplication =
      applicationId !== undefined
        ? flatApplicationMaps.byId[applicationId]
        : undefined;

    if (applicationId === undefined || flatApplication === undefined) {
      throw new WorkspaceMigrationRunnerException({
        message: `Could not find application for application with universal identifier: ${applicationUniversalIdentifier}`,
        code: WorkspaceMigrationRunnerExceptionCode.APPLICATION_NOT_FOUND,
      });
    }

    this.logger.time('Runner', 'Transaction execution');

    // PORT-NOTE: Mongo has no equivalent of TypeORM QueryRunner transactions.
    // We pass a minimal stub; individual action handlers should use Mongo sessions
    // where atomicity is needed. The try/catch rollback behavior is preserved.
    const queryRunner = { stub: true } as unknown as never;

    const allMetadataEvents: MetadataEvent[] = [];

    try {
      for (const action of actions) {
        const { partialOptimisticCache, metadataEvents } =
          await this.workspaceMigrationRunnerActionHandlerRegistry.executeActionHandler(
            {
              action,
              context: {
                flatApplication: flatApplication as Parameters<typeof this.workspaceMigrationRunnerActionHandlerRegistry.executeActionHandler>[0]['context']['flatApplication'],
                action,
                allFlatEntityMaps: allFlatEntityMaps as AllFlatEntityMaps,
                queryRunner,
                workspaceId,
              },
            },
          );

        allFlatEntityMaps = {
          ...allFlatEntityMaps,
          ...partialOptimisticCache,
        } as typeof allFlatEntityMaps;

        allMetadataEvents.push(...metadataEvents);
      }

      this.logger.timeEnd('Runner', 'Transaction execution');
    } catch (error) {
      const invertedActions = [...actions].reverse();

      for (const invertedAction of invertedActions) {
        await this.workspaceMigrationRunnerActionHandlerRegistry.executeActionRollbackHandler(
          {
            action: invertedAction,
            context: {
              flatApplication: flatApplication as Parameters<typeof this.workspaceMigrationRunnerActionHandlerRegistry.executeActionHandler>[0]['context']['flatApplication'],
              action: invertedAction,
              allFlatEntityMaps: allFlatEntityMaps as AllFlatEntityMaps,
              workspaceId,
            },
          },
        );
      }

      try {
        await this.invalidateCache({
          allFlatEntityMapsKeys,
          workspaceId,
        });
      } catch (cacheError) {
        this.logger.error(
          `Cache invalidation failed after rollback: ${cacheError}`,
          'Runner',
        );
      }

      if (error instanceof WorkspaceMigrationRunnerException) {
        throw error;
      }

      throw new WorkspaceMigrationRunnerException({
        message: error instanceof Error ? error.message : String(error),
        code: WorkspaceMigrationRunnerExceptionCode.INTERNAL_SERVER_ERROR,
      });
    }

    try {
      await this.invalidateCache({
        allFlatEntityMapsKeys,
        workspaceId,
      });
    } catch (cacheError) {
      this.logger.error(
        `Cache invalidation failed after committed transaction: ${cacheError}`,
        'Runner',
      );
    }

    const hasSchemaMetadataChanged =
      allFlatEntityMapsKeys.includes('flatObjectMetadataMaps') ||
      allFlatEntityMapsKeys.includes('flatFieldMetadataMaps');

    this.logger.timeEnd('Runner', 'Total execution');

    return {
      allFlatEntityMaps: allFlatEntityMaps as AllFlatEntityMaps,
      metadataEvents: allMetadataEvents,
      hasSchemaMetadataChanged,
    };
  };
}
