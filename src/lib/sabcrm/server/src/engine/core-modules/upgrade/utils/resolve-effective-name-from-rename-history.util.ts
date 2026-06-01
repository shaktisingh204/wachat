// PORT-NOTE: WasRenamedInUpgradeHistoryEntry is defined in the decorator
// file that lives at:
//   src/lib/sabcrm/server/src/engine/core-modules/upgrade/decorators/was-renamed-in-upgrade.decorator.ts
// Until that file is ported, the shape is inlined here for self-containment.

export type WasRenamedInUpgradeHistoryEntry = {
  upgradeCommandName: string;
  previousName: string;
};

/**
 * Walks the rename history from most-recent to oldest and returns the name
 * that was in effect *before* each rename command was applied.
 *
 * If every step in the history has already been applied, the current name is
 * returned unchanged.
 */
export const resolveEffectiveNameFromRenameHistory = ({
  currentName,
  history,
  isStepApplied,
}: {
  currentName: string;
  history: WasRenamedInUpgradeHistoryEntry[];
  isStepApplied: (stepName: string) => boolean;
}): string => {
  for (const entry of history) {
    if (!isStepApplied(entry.upgradeCommandName)) {
      return entry.previousName;
    }
  }

  return currentName;
};
