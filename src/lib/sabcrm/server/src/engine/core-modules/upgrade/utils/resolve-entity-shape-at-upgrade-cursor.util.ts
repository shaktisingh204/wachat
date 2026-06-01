// PORT-NOTE: This util references decorator helpers from the upgrade decorator
// files (was-introduced-in-upgrade.decorator, was-removed-in-upgrade.decorator,
// was-renamed-in-upgrade.decorator). Those decorators exist in the Twenty ORM
// layer which has no direct Next.js equivalent. The util is ported faithfully;
// callers must supply the metadata accessor functions from the ported decorator
// modules once those are available.

import { type WasRenamedInUpgradeHistoryEntry, resolveEffectiveNameFromRenameHistory } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/resolve-effective-name-from-rename-history.util";

// -- Metadata accessor stubs -------------------------------------------------
// These will be replaced by imports from the actual ported decorator files.

type IntroducedMeta = { upgradeCommandName: string } | undefined;
type RemovedMeta = { upgradeCommandName: string } | undefined;
type PropertyMetaMap = Record<string, { upgradeCommandName: string }>;
type PropertyRenameMap = Record<string, WasRenamedInUpgradeHistoryEntry[]>;

// Callers pass a EntityMetadataAccessors object rather than relying on reflect-metadata.
export type EntityMetadataAccessors = {
  getClassIntroduced: (entityClass: Function) => IntroducedMeta;
  getClassRemoved: (entityClass: Function) => RemovedMeta;
  getClassRenameHistory: (entityClass: Function) => WasRenamedInUpgradeHistoryEntry[] | undefined;
  getPropertyIntroductionMap: (entityClass: Function) => PropertyMetaMap;
  getPropertyRemovalMap: (entityClass: Function) => PropertyMetaMap;
  getPropertyRenameMap: (entityClass: Function) => PropertyRenameMap;
};

// ---------------------------------------------------------------------------

export type ResolvedEntityShapeAtUpgradeCursor = {
  isAvailable: boolean;
  effectiveTableName: string;
  hiddenPropertyNames: ReadonlySet<string>;
  columnDatabaseNameRemap: ReadonlyMap<string, string>;
};

export const resolveEntityShapeAtUpgradeCursor = ({
  entityClass,
  currentTableName,
  currentColumns,
  isStepApplied,
  accessors,
}: {
  entityClass: Function;
  currentTableName: string;
  currentColumns: { propertyName: string; databaseName: string }[];
  isStepApplied: (stepName: string) => boolean;
  accessors: EntityMetadataAccessors;
}): ResolvedEntityShapeAtUpgradeCursor => {
  const classIntroduced = accessors.getClassIntroduced(entityClass);
  const isAvailable =
    classIntroduced == null || isStepApplied(classIntroduced.upgradeCommandName);

  const classRenameHistory = accessors.getClassRenameHistory(entityClass) ?? [];
  const effectiveTableName = resolveEffectiveNameFromRenameHistory({
    currentName: currentTableName,
    history: classRenameHistory,
    isStepApplied,
  });

  const propertyIntroductionMap = accessors.getPropertyIntroductionMap(entityClass);
  const propertyRemovalMap = accessors.getPropertyRemovalMap(entityClass);
  const propertyRenameMap = accessors.getPropertyRenameMap(entityClass);

  const hiddenPropertyNames = new Set<string>();
  const columnDatabaseNameRemap = new Map<string, string>();

  for (const column of currentColumns) {
    const introduced = propertyIntroductionMap[column.propertyName];

    if (introduced != null && !isStepApplied(introduced.upgradeCommandName)) {
      hiddenPropertyNames.add(column.propertyName);
      continue;
    }

    const removed = propertyRemovalMap[column.propertyName];

    if (removed != null && isStepApplied(removed.upgradeCommandName)) {
      hiddenPropertyNames.add(column.propertyName);
      continue;
    }

    const renameHistory = propertyRenameMap[column.propertyName] ?? [];

    if (renameHistory.length === 0) {
      continue;
    }

    const effectiveColumnName = resolveEffectiveNameFromRenameHistory({
      currentName: column.databaseName,
      history: renameHistory,
      isStepApplied,
    });

    if (effectiveColumnName !== column.databaseName) {
      columnDatabaseNameRemap.set(column.propertyName, effectiveColumnName);
    }
  }

  return {
    isAvailable,
    effectiveTableName,
    hiddenPropertyNames,
    columnDatabaseNameRemap,
  };
};
