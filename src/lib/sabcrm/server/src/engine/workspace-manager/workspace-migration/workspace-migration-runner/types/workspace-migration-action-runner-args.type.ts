// PORT-NOTE: Pure type module. TypeORM QueryRunner replaced with an opaque
// 'unknown' alias — Mongo has no direct equivalent. Callers may pass a
// Mongo ClientSession-wrapped object or undefined for non-transactional paths.

import { type FlatApplication } from '@/lib/sabcrm/server/src/engine/core-modules/application/types/flat-application.type';
import { type AllFlatEntityMaps } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type';
import {
  type AllFlatWorkspaceMigrationAction,
  type AllUniversalWorkspaceMigrationAction,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/workspace-migration-action-common';

// PORT-NOTE: TypeORM QueryRunner replaced with unknown — Mongo sessions are
// passed by callers that need transactional behaviour.
export type QueryRunnerStub = unknown;

export type WorkspaceMigrationActionRunnerArgs<
  TUniversalAction extends AllUniversalWorkspaceMigrationAction,
> = {
  queryRunner: QueryRunnerStub;
  action: TUniversalAction;
  allFlatEntityMaps: AllFlatEntityMaps;
  workspaceId: string;
  flatApplication: FlatApplication;
};

export type WorkspaceMigrationActionRunnerContext<
  TFlatAction extends AllFlatWorkspaceMigrationAction,
  TUniversalAction extends AllUniversalWorkspaceMigrationAction =
    AllUniversalWorkspaceMigrationAction,
> = WorkspaceMigrationActionRunnerArgs<TUniversalAction> & {
  flatAction: TFlatAction;
};
