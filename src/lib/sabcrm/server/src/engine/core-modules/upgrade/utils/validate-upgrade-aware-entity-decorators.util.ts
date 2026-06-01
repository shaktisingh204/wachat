// PORT-NOTE: This util originally used reflect-metadata decorator accessor
// helpers (getWasIntroducedInUpgradeClassMetadata, etc.) from NestJS/TypeORM
// decorator files. In SabNode those decorators are not available, so callers
// must pass the same metadata through the EntityMetadataAccessors pattern
// (see resolve-entity-shape-at-upgrade-cursor.util.ts). The validation logic
// itself is ported faithfully.

import { type WasRenamedInUpgradeHistoryEntry } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/resolve-effective-name-from-rename-history.util";

export type UpgradeAwareDecoratorReferenceProblem =
  | {
      kind: "unknown-step-name";
      entityName: string;
      decorator:
        | "@WasIntroducedInUpgrade"
        | "@WasRemovedInUpgrade"
        | "@WasRenamedInUpgrade";
      scope: "class" | `property:${string}`;
      upgradeCommandName: string;
    }
  | {
      kind: "rename-history-out-of-order";
      entityName: string;
      scope: "class" | `property:${string}`;
      offendingUpgradeCommandName: string;
      precedingUpgradeCommandName: string;
    }
  | {
      kind: "removal-before-introduction";
      entityName: string;
      scope: "class" | `property:${string}`;
      introductionUpgradeCommandName: string;
      removalUpgradeCommandName: string;
    };

// Caller-supplied descriptor for an entity — replaces reflect-metadata lookups.
type EntityDescriptor = {
  name: string;
  classIntroduced?: { upgradeCommandName: string };
  classRemoved?: { upgradeCommandName: string };
  classRenameHistory?: WasRenamedInUpgradeHistoryEntry[];
  propIntroducedMap?: Record<string, { upgradeCommandName: string }>;
  propRemovedMap?: Record<string, { upgradeCommandName: string }>;
  propRenameMap?: Record<string, WasRenamedInUpgradeHistoryEntry[]>;
};

export const validateUpgradeAwareEntityDecorators = ({
  entities,
  stepNameToIndex,
}: {
  entities: EntityDescriptor[];
  stepNameToIndex: ReadonlyMap<string, number>;
}): UpgradeAwareDecoratorReferenceProblem[] => {
  const problems: UpgradeAwareDecoratorReferenceProblem[] = [];

  for (const entity of entities) {
    const { name: entityName } = entity;

    if (
      entity.classIntroduced != null &&
      !stepNameToIndex.has(entity.classIntroduced.upgradeCommandName)
    ) {
      problems.push({
        kind: "unknown-step-name",
        entityName,
        decorator: "@WasIntroducedInUpgrade",
        scope: "class",
        upgradeCommandName: entity.classIntroduced.upgradeCommandName,
      });
    }

    if (
      entity.classRemoved != null &&
      !stepNameToIndex.has(entity.classRemoved.upgradeCommandName)
    ) {
      problems.push({
        kind: "unknown-step-name",
        entityName,
        decorator: "@WasRemovedInUpgrade",
        scope: "class",
        upgradeCommandName: entity.classRemoved.upgradeCommandName,
      });
    }

    checkRemovalAfterIntroduction({
      entityName,
      scope: "class",
      introduced: entity.classIntroduced,
      removed: entity.classRemoved,
      stepNameToIndex,
      problems,
    });

    checkHistoryForReferenceAndOrder({
      entityName,
      scope: "class",
      history: entity.classRenameHistory ?? [],
      stepNameToIndex,
      problems,
    });

    const propIntroducedMap = entity.propIntroducedMap ?? {};

    for (const [propertyName, options] of Object.entries(propIntroducedMap)) {
      if (!stepNameToIndex.has(options.upgradeCommandName)) {
        problems.push({
          kind: "unknown-step-name",
          entityName,
          decorator: "@WasIntroducedInUpgrade",
          scope: `property:${propertyName}`,
          upgradeCommandName: options.upgradeCommandName,
        });
      }
    }

    const propRemovedMap = entity.propRemovedMap ?? {};

    for (const [propertyName, options] of Object.entries(propRemovedMap)) {
      if (!stepNameToIndex.has(options.upgradeCommandName)) {
        problems.push({
          kind: "unknown-step-name",
          entityName,
          decorator: "@WasRemovedInUpgrade",
          scope: `property:${propertyName}`,
          upgradeCommandName: options.upgradeCommandName,
        });
      }

      checkRemovalAfterIntroduction({
        entityName,
        scope: `property:${propertyName}`,
        introduced: propIntroducedMap[propertyName],
        removed: options,
        stepNameToIndex,
        problems,
      });
    }

    const propRenameMap = entity.propRenameMap ?? {};

    for (const [propertyName, history] of Object.entries(propRenameMap)) {
      checkHistoryForReferenceAndOrder({
        entityName,
        scope: `property:${propertyName}`,
        history,
        stepNameToIndex,
        problems,
      });
    }
  }

  return problems;
};

const checkHistoryForReferenceAndOrder = ({
  entityName,
  scope,
  history,
  stepNameToIndex,
  problems,
}: {
  entityName: string;
  scope: "class" | `property:${string}`;
  history: WasRenamedInUpgradeHistoryEntry[];
  stepNameToIndex: ReadonlyMap<string, number>;
  problems: UpgradeAwareDecoratorReferenceProblem[];
}): void => {
  let previousIndex = -1;
  let previousName: string | undefined;

  for (const entry of history) {
    const index = stepNameToIndex.get(entry.upgradeCommandName);

    if (index == null) {
      problems.push({
        kind: "unknown-step-name",
        entityName,
        decorator: "@WasRenamedInUpgrade",
        scope,
        upgradeCommandName: entry.upgradeCommandName,
      });
      continue;
    }

    if (index <= previousIndex) {
      problems.push({
        kind: "rename-history-out-of-order",
        entityName,
        scope,
        offendingUpgradeCommandName: entry.upgradeCommandName,
        precedingUpgradeCommandName: previousName ?? "",
      });
    }

    previousIndex = index;
    previousName = entry.upgradeCommandName;
  }
};

const checkRemovalAfterIntroduction = ({
  entityName,
  scope,
  introduced,
  removed,
  stepNameToIndex,
  problems,
}: {
  entityName: string;
  scope: "class" | `property:${string}`;
  introduced: { upgradeCommandName: string } | undefined;
  removed: { upgradeCommandName: string } | undefined;
  stepNameToIndex: ReadonlyMap<string, number>;
  problems: UpgradeAwareDecoratorReferenceProblem[];
}): void => {
  if (introduced == null || removed == null) {
    return;
  }

  const introducedIndex = stepNameToIndex.get(introduced.upgradeCommandName);
  const removedIndex = stepNameToIndex.get(removed.upgradeCommandName);

  if (introducedIndex == null || removedIndex == null) {
    return;
  }

  if (removedIndex <= introducedIndex) {
    problems.push({
      kind: "removal-before-introduction",
      entityName,
      scope,
      introductionUpgradeCommandName: introduced.upgradeCommandName,
      removalUpgradeCommandName: removed.upgradeCommandName,
    });
  }
};

export const formatUpgradeAwareDecoratorReferenceProblems = (
  problems: UpgradeAwareDecoratorReferenceProblem[],
): string =>
  problems
    .map((problem) => {
      if (problem.kind === "unknown-step-name") {
        return `  - ${problem.entityName} ${problem.decorator} (${problem.scope}): unknown upgradeCommandName "${problem.upgradeCommandName}"`;
      }

      if (problem.kind === "rename-history-out-of-order") {
        return `  - ${problem.entityName} @WasRenamedInUpgrade (${problem.scope}): "${problem.offendingUpgradeCommandName}" must come after "${problem.precedingUpgradeCommandName}" in the upgrade sequence`;
      }

      return `  - ${problem.entityName} @WasRemovedInUpgrade (${problem.scope}): removal step "${problem.removalUpgradeCommandName}" must come after introduction step "${problem.introductionUpgradeCommandName}" in the upgrade sequence`;
    })
    .join("\n");
