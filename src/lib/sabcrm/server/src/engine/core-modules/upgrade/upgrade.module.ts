// PORT-NOTE: NestJS @Module wiring has no Next.js equivalent.
// This file re-exports all ported pieces from the upgrade module so that
// consuming code can import from a single barrel rather than individual paths.
// NestJS module imports (DiscoveryModule, TypeOrmModule, etc.) are omitted.

// Entity / collection
export {
  type UpgradeMigrationDocument,
  type UpgradeMigrationStatus,
  getUpgradeMigrationCollection,
  ensureUpgradeMigrationIndexes,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-migration.entity";

// Services
export {
  type WorkspaceLastAttemptedCommand,
  getInferredVersion,
  isLastAttemptCompleted,
  recordUpgradeMigration,
  markAsWorkspaceInitial,
  getLastAttemptedCommandNameOrThrow,
  getWorkspaceLastAttemptedCommandName,
  getWorkspaceLastAttemptedCommandNameOrThrow,
  areAllWorkspacesAtCommand,
  getLastAttemptedInstanceCommand,
  getLastAttemptedInstanceCommandOrThrow,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-migration.service";

export {
  type RegisteredFastInstanceCommand,
  type RegisteredSlowInstanceCommand,
  type RegisteredWorkspaceCommand,
  type VersionBundle,
  type FastInstanceUpgradeStep,
  type SlowInstanceUpgradeStep,
  type InstanceUpgradeStep,
  type WorkspaceUpgradeStep,
  type UpgradeStep,
  TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS,
  getUpgradeSequence,
  locateStepInSequenceOrThrow,
  getWorkspaceSegmentBounds,
  collectWorkspaceCommandsStartingFrom,
  getPendingWorkspaceCommands,
  getInitialCursorForNewWorkspace,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service";

export {
  type UpgradeSequenceRunnerReport,
  type ParsedUpgradeCommandOptions,
  type WorkspaceIteratorContext,
  type WorkspaceIteratorReport,
  runUpgradeSequence,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-runner.service";

export {
  type RunWorkspaceCommandsArgs,
  runWorkspaceCommands,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/workspace-command-runner.service";

export {
  type LatestUpgradeCommand,
  type InstanceUpgradeStatus,
  type WorkspaceUpgradeStatus,
  type WorkspaceUpgradeRef,
  type InstanceAndAllWorkspacesUpgradeStatus,
  type WorkspaceRecord,
  UpgradeHealthEnum,
  WorkspaceActivationStatus,
  getInstanceStatus,
  getWorkspaceStatuses,
  getInstanceAndAllWorkspacesStatus,
  refreshInstanceAndAllWorkspacesStatus,
  invalidateInstanceAndAllWorkspacesStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status.service";

export {
  getComputedAt,
  getBehindWorkspaceIds,
  getFailedWorkspaceIds,
  getUpToDateWorkspaceCount,
  writeUpgradeStatusCache,
  invalidateUpgradeStatusCache,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status-cache.service";

export {
  getCachedUpgradeStatus,
  getUpgradeGaugeValues,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-gauge.service";

// Utils
export { extractVersionFromCommandName } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/extract-version-from-command-name.util";
export { formatUpgradeErrorForStorage } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/format-upgrade-error-for-storage.util";
export { formatUpgradeLog } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/format-upgrade-log.util";
export {
  type WasRenamedInUpgradeHistoryEntry,
  resolveEffectiveNameFromRenameHistory,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/resolve-effective-name-from-rename-history.util";
export {
  type ResolvedEntityShapeAtUpgradeCursor,
  type EntityMetadataAccessors,
  resolveEntityShapeAtUpgradeCursor,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/resolve-entity-shape-at-upgrade-cursor.util";
export {
  type UpgradeAwareDecoratorReferenceProblem,
  validateUpgradeAwareEntityDecorators,
  formatUpgradeAwareDecoratorReferenceProblems,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/validate-upgrade-aware-entity-decorators.util";

// Types
export {
  type TwentyAllVersion,
  type RemovedSinceVersion,
  TWENTY_ALL_VERSIONS,
  TWENTY_CURRENT_VERSION,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/types/removed-since-version.type";
