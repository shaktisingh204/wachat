// PORT-NOTE: Ported from NestJS abstract class + decorator factory.
// NestJS DI (@Inject, SetMetadata, QueryRunner) replaced with plain TS.
// LoggerService replaced with console-based logger interface.
// TypeORM QueryRunner removed — Mongo has no direct equivalent; passed as 'unknown'
// so callers can provide their own session/context handle if needed.
// The abstract class pattern and all method signatures are preserved faithfully.

import { type AllMetadataName } from '@/lib/sabcrm/shared/src/metadata/types/all-metadata-name';
import { type AllFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type';
import { type AllFlatWorkspaceMigrationAction, type AllUniversalWorkspaceMigrationAction, buildActionHandlerKey } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/workspace-migration-action-common';
import { type FlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type MetadataFlatEntity } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-flat-entity.type';
import { type MetadataRelatedFlatEntityMapsKeys } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-related-flat-entity-maps-keys.type';
import { type MetadataToFlatEntityMapsKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-to-flat-entity-maps-key';
import { type WorkspaceMigrationActionType } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/metadata-workspace-migration-action.type';
import { findFlatEntityByUniversalIdentifierOrThrow } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util';
import { getMetadataFlatEntityMapsKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-flat-entity-maps-key.util';
import { type UniversalFlatEntityUpdate } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-entity-update.type';
import { sanitizeUniversalFlatEntityUpdate } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/sanitize-universal-flat-entity-update.util';
import { type BaseFlatDeleteWorkspaceMigrationAction } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/base-flat-delete-workspace-migration-action.type';
import { WORKSPACE_MIGRATION_ACTION_HANDLER_METADATA_KEY } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/constants/workspace-migration-action-handler-metadata-key.constant';
import {
  WorkspaceMigrationRunnerException,
  WorkspaceMigrationRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/exceptions/workspace-migration-runner.exception';
import { type MetadataEvent } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/metadata-event';
import {
  type WorkspaceMigrationActionRunnerArgs,
  type WorkspaceMigrationActionRunnerContext,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type';
import { deriveMetadataEventsFromCreateAction } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/derive-metadata-events-from-create-action.util';
import { deriveMetadataEventsFromDeleteAction } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/derive-metadata-events-from-delete-action.util';
import { deriveMetadataEventsFromUpdateAction } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/derive-metadata-events-from-update-action.util';
import { flatEntityToScalarFlatEntity } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/flat-entity-to-scalar-flat-entity.util';
import { optimisticallyApplyCreateActionOnAllFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/optimistically-apply-create-action-on-all-flat-entity-maps.util';
import { optimisticallyApplyDeleteActionOnAllFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/optimistically-apply-delete-action-on-all-flat-entity-maps.util';
import { optimisticallyApplyUpdateActionOnAllFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/optimistically-apply-update-action-on-all-flat-entity-maps.util';

// Minimal logger interface — replaces NestJS LoggerService
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

type FlatActionWithAllFlatEntityMapsArgs<
  TFlatAction extends AllFlatWorkspaceMigrationAction,
> = {
  flatAction: TFlatAction;
  allFlatEntityMaps: AllFlatEntityMaps;
};

export type ActionHandlerExecuteResult<TMetadataName extends AllMetadataName> =
  {
    partialOptimisticCache: Pick<
      AllFlatEntityMaps,
      | MetadataRelatedFlatEntityMapsKeys<TMetadataName>
      | MetadataToFlatEntityMapsKey<TMetadataName>
    >;
    metadataEvents: MetadataEvent[];
  };

export abstract class BaseWorkspaceMigrationRunnerActionHandlerService<
  TActionType extends WorkspaceMigrationActionType,
  TMetadataName extends AllMetadataName,
  TUniversalAction extends AllUniversalWorkspaceMigrationAction = AllUniversalWorkspaceMigrationAction<
    TActionType,
    TMetadataName
  >,
  TFlatAction extends AllFlatWorkspaceMigrationAction = AllFlatWorkspaceMigrationAction<
    TActionType,
    TMetadataName
  >,
> {
  public actionType!: TActionType;
  public metadataName!: TMetadataName;

  protected readonly logger: ILogger = defaultLogger;

  public abstract transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<TUniversalAction>,
  ): Promise<TFlatAction>;

  protected transpileUniversalDeleteActionToFlatDeleteAction(
    context: 'delete' extends TActionType
      ? WorkspaceMigrationActionRunnerArgs<
          AllUniversalWorkspaceMigrationAction<'delete'>
        >
      : never,
  ): BaseFlatDeleteWorkspaceMigrationAction<TMetadataName> {
    const { action, allFlatEntityMaps } = context as WorkspaceMigrationActionRunnerArgs<
      AllUniversalWorkspaceMigrationAction<'delete'>
    >;

    const flatEntityMaps = allFlatEntityMaps[
      getMetadataFlatEntityMapsKey(action.metadataName)
    ] as FlatEntityMaps<MetadataFlatEntity<typeof action.metadataName>>;

    const flatEntity = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps,
      universalIdentifier: action.universalIdentifier,
    });

    return {
      type: 'delete',
      metadataName: this.metadataName,
      entityId: flatEntity.id,
    };
  }

  executeForMetadata(
    _context: WorkspaceMigrationActionRunnerContext<TFlatAction>,
  ): Promise<void> {
    return Promise.resolve();
  }

  executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<TFlatAction>,
  ): Promise<void> {
    return Promise.resolve();
  }

  private optimisticallyApplyActionOnAllFlatEntityMaps({
    flatAction,
    allFlatEntityMaps,
  }: FlatActionWithAllFlatEntityMapsArgs<TFlatAction>): Pick<
    AllFlatEntityMaps,
    | MetadataRelatedFlatEntityMapsKeys<TMetadataName>
    | MetadataToFlatEntityMapsKey<TMetadataName>
  > {
    switch (flatAction.type) {
      case 'create': {
        return optimisticallyApplyCreateActionOnAllFlatEntityMaps({
          flatAction,
          allFlatEntityMaps,
        });
      }
      case 'delete': {
        return optimisticallyApplyDeleteActionOnAllFlatEntityMaps({
          flatAction,
          allFlatEntityMaps,
        });
      }
      case 'update': {
        return optimisticallyApplyUpdateActionOnAllFlatEntityMaps({
          flatAction,
          allFlatEntityMaps,
        });
      }
    }
  }

  private deriveMetadataEventsFromFlatAction({
    flatAction,
    allFlatEntityMaps,
  }: FlatActionWithAllFlatEntityMapsArgs<TFlatAction>): MetadataEvent[] {
    switch (flatAction.type) {
      case 'create': {
        return deriveMetadataEventsFromCreateAction(flatAction);
      }
      case 'delete': {
        return deriveMetadataEventsFromDeleteAction({
          flatAction,
          allFlatEntityMaps,
        });
      }
      case 'update': {
        return deriveMetadataEventsFromUpdateAction({
          flatAction,
          allFlatEntityMaps,
        });
      }
    }
  }

  rollbackForMetadata(
    _context: Omit<
      WorkspaceMigrationActionRunnerArgs<TUniversalAction>,
      'queryRunner'
    >,
  ): Promise<void> {
    return Promise.resolve();
  }

  private sanitizeUniversalAction(
    universalAction: TUniversalAction,
  ): TUniversalAction {
    if (universalAction.type === 'update') {
      const sanitizedFlatEntityUpdate = sanitizeUniversalFlatEntityUpdate({
        metadataName: universalAction.metadataName,
        flatEntityUpdate: universalAction.update as UniversalFlatEntityUpdate<
          typeof universalAction.metadataName
        >,
      });

      return {
        ...universalAction,
        update: sanitizedFlatEntityUpdate,
      };
    }

    return universalAction;
  }

  private async transpileUniversalActionToFlatActionOrThrow(
    context: WorkspaceMigrationActionRunnerArgs<TUniversalAction>,
  ): Promise<TFlatAction> {
    try {
      const sanitizedUniversalAction = this.sanitizeUniversalAction(
        context.action,
      );

      return await this.transpileUniversalActionToFlatAction({
        ...context,
        action: sanitizedUniversalAction,
      });
    } catch (error) {
      throw new WorkspaceMigrationRunnerException({
        action: context.action,
        errors: {
          actionTranspilation: error instanceof Error ? error : new Error(String(error)),
        },
        code: WorkspaceMigrationRunnerExceptionCode.EXECUTION_FAILED,
      });
    }
  }

  async execute(
    context: WorkspaceMigrationActionRunnerArgs<TUniversalAction>,
  ): Promise<ActionHandlerExecuteResult<TMetadataName>> {
    const flatAction =
      await this.transpileUniversalActionToFlatActionOrThrow(context);

    const [metadataResult, workspaceSchemaResult] = await Promise.allSettled([
      this.asyncMethodPerformanceMetricWrapper({
        label: 'executeForMetadata',
        method: async () => this.executeForMetadata({ ...context, flatAction }),
      }),
      this.asyncMethodPerformanceMetricWrapper({
        label: 'executeForWorkspaceSchema',
        method: async () =>
          this.executeForWorkspaceSchema({ ...context, flatAction }),
      }),
    ]);

    const hasMetadataError = metadataResult.status === 'rejected';
    const hasWorkspaceSchemaError = workspaceSchemaResult.status === 'rejected';

    if (hasMetadataError || hasWorkspaceSchemaError) {
      throw new WorkspaceMigrationRunnerException({
        action: context.action,
        errors: {
          ...(hasMetadataError && {
            metadata: metadataResult.reason instanceof Error
              ? metadataResult.reason
              : new Error(String(metadataResult.reason)),
          }),
          ...(hasWorkspaceSchemaError && {
            workspaceSchema: workspaceSchemaResult.reason instanceof Error
              ? workspaceSchemaResult.reason
              : new Error(String(workspaceSchemaResult.reason)),
          }),
        },
        code: WorkspaceMigrationRunnerExceptionCode.EXECUTION_FAILED,
      });
    }

    const metadataEvents = this.deriveMetadataEventsFromFlatAction({
      flatAction,
      allFlatEntityMaps: context.allFlatEntityMaps,
    });

    const partialOptimisticCache =
      this.optimisticallyApplyActionOnAllFlatEntityMaps({
        flatAction,
        allFlatEntityMaps: context.allFlatEntityMaps,
      });

    return { partialOptimisticCache, metadataEvents };
  }

  async rollback(
    context: Omit<
      WorkspaceMigrationActionRunnerArgs<TUniversalAction>,
      'queryRunner'
    >,
  ): Promise<void> {
    try {
      await this.rollbackForMetadata(context);
    } catch (error) {
      this.logger.error(
        `Failed to rollback ${context.action.type} action for ${context.action.metadataName}: ${error instanceof Error ? error.message : String(error)}`,
        'BaseWorkspaceMigrationRunnerActionHandlerService',
      );
    }
  }

  private async asyncMethodPerformanceMetricWrapper({
    label,
    method,
  }: {
    label: string;
    method: () => Promise<void>;
  }): Promise<void> {
    this.logger.time(
      'BaseWorkspaceMigrationRunnerActionHandlerService',
      `${this.actionType}_${this.metadataName} ${label}`,
    );
    await method();
    this.logger.timeEnd(
      'BaseWorkspaceMigrationRunnerActionHandlerService',
      `${this.actionType}_${this.metadataName} ${label}`,
    );
  }
}

// Registry decorator factory — replaces NestJS SetMetadata decorator
export function WorkspaceMigrationRunnerActionHandler<
  TActionType extends WorkspaceMigrationActionType,
  TMetadataName extends AllMetadataName,
>(
  actionType: TActionType,
  metadataName: TMetadataName,
): typeof BaseWorkspaceMigrationRunnerActionHandlerService<
  TActionType,
  TMetadataName
> {
  abstract class ActionHandlerService extends BaseWorkspaceMigrationRunnerActionHandlerService<
    TActionType,
    TMetadataName
  > {
    actionType = actionType;
    metadataName = metadataName;
  }

  // Store the handler key as a static property instead of NestJS metadata
  (ActionHandlerService as Record<string, unknown>)[
    WORKSPACE_MIGRATION_ACTION_HANDLER_METADATA_KEY
  ] = buildActionHandlerKey(actionType, metadataName);

  return ActionHandlerService;
}
