// PORT-NOTE: service — NestJS @Injectable / DiscoveryService DI removed.
// The NestJS DiscoveryService scans the IoC container for providers decorated
// with @RegisteredInstanceCommand / @RegisteredWorkspaceCommand at module init.
// In Next.js there is no IoC container; commands must be registered explicitly
// by calling registerInstanceCommand() / registerWorkspaceCommand() at startup
// (e.g., from your app bootstrap script or the route that triggers upgrades).
// The same validation and sorting logic is preserved faithfully.

import { isDefined } from "@/lib/sabcrm/shared/src/utils/validation/isDefined";

import {
  TWENTY_ALL_VERSIONS,
  type TwentyAllVersion,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-all-versions.constant";
import { TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-cross-upgrade-supported-version.constant";
import { TWENTY_CURRENT_VERSION } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant";
import { TWENTY_NEXT_VERSIONS } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-next-versions.constant";
import { TWENTY_PREVIOUS_VERSIONS } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-previous-versions.constant";
import {
  getRegisteredInstanceCommandMetadata,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator";
import {
  getRegisteredWorkspaceCommandMetadata,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator";
import { type FastInstanceCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface";
import { type SlowInstanceCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/slow-instance-command.interface";

// PORT-NOTE: WorkspaceCommandRunner / ActiveOrSuspendedWorkspaceCommandRunner are
// typed as a generic async-callable interface until those modules are ported.
export type WorkspaceCommandRunner = {
  run(workspaceId: string): Promise<void>;
};

export type RegisteredFastInstanceCommand = {
  name: string;
  command: FastInstanceCommand;
  version: TwentyAllVersion;
  timestamp: number;
};

export type RegisteredSlowInstanceCommand = {
  name: string;
  command: SlowInstanceCommand;
  version: TwentyAllVersion;
  timestamp: number;
};

export type RegisteredWorkspaceCommand = {
  name: string;
  command: WorkspaceCommandRunner;
  version: TwentyAllVersion;
  timestamp: number;
};

type VersionBundle = {
  fastInstanceCommands: RegisteredFastInstanceCommand[];
  slowInstanceCommands: RegisteredSlowInstanceCommand[];
  workspaceCommands: RegisteredWorkspaceCommand[];
};

const buildEmptyVersionBundle = (): VersionBundle => ({
  fastInstanceCommands: [],
  slowInstanceCommands: [],
  workspaceCommands: [],
});

// Module-level registry (singleton for the process lifetime)
const bundlesByVersion = new Map<TwentyAllVersion, VersionBundle>();

function ensureBundleMapInitialized(): void {
  if (bundlesByVersion.size === 0) {
    for (const version of TWENTY_ALL_VERSIONS) {
      bundlesByVersion.set(version, buildEmptyVersionBundle());
    }
  }
}

function computeCommandName(
  version: TwentyAllVersion,
  className: string,
  timestamp: number,
): string {
  return `${version}_${className}_${timestamp}`;
}

function validateNoTimestampDuplicatesWithinKind(
  version: TwentyAllVersion,
  kind: "fast-instance" | "slow-instance" | "workspace",
  entries:
    | RegisteredFastInstanceCommand[]
    | RegisteredSlowInstanceCommand[]
    | RegisteredWorkspaceCommand[],
): void {
  const seenTimestamps = new Set<number>();
  for (const entry of entries) {
    if (seenTimestamps.has(entry.timestamp)) {
      throw new Error(
        `Duplicate ${kind} command timestamp ${entry.timestamp} in version ${version} (command: ${entry.name})`,
      );
    }
    seenTimestamps.add(entry.timestamp);
  }
}

function validateNoDuplicates(): void {
  for (const [version, bundle] of bundlesByVersion) {
    validateNoTimestampDuplicatesWithinKind(
      version,
      "fast-instance",
      bundle.fastInstanceCommands,
    );
    validateNoTimestampDuplicatesWithinKind(
      version,
      "slow-instance",
      bundle.slowInstanceCommands,
    );
    validateNoTimestampDuplicatesWithinKind(
      version,
      "workspace",
      bundle.workspaceCommands,
    );

    const seenNames = new Set<string>();
    const allNames = [
      ...bundle.fastInstanceCommands.map((e) => e.name),
      ...bundle.slowInstanceCommands.map((e) => e.name),
      ...bundle.workspaceCommands.map((e) => e.name),
    ];
    for (const name of allNames) {
      if (seenNames.has(name)) {
        throw new Error(
          `Duplicate upgrade command name "${name}" in version ${version}`,
        );
      }
      seenNames.add(name);
    }
  }
}

function validateAtLeastOneVersionBundleHasWorkspaceCommands(): void {
  let hasWorkspaceCommands = false;
  for (const version of TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS) {
    const bundle = bundlesByVersion.get(version as TwentyAllVersion);
    if (bundle && bundle.workspaceCommands.length > 0) {
      hasWorkspaceCommands = true;
    }
  }
  if (!hasWorkspaceCommands) {
    throw new Error(
      "Upgrade sequence must contain at least one workspace command",
    );
  }
}

function validateNoVersionDuplicatesAcrossConstants(): void {
  const allVersions = [
    ...TWENTY_PREVIOUS_VERSIONS,
    TWENTY_CURRENT_VERSION,
    ...TWENTY_NEXT_VERSIONS,
  ];
  const uniqueVersions = new Set(allVersions);
  if (uniqueVersions.size !== allVersions.length) {
    const duplicates = allVersions.filter(
      (version, index) => allVersions.indexOf(version) !== index,
    );
    throw new Error(
      `Duplicate version(s) across TWENTY_PREVIOUS_VERSIONS, TWENTY_CURRENT_VERSION, and TWENTY_NEXT_VERSIONS: ${duplicates.join(", ")}`,
    );
  }
}

function validatePreviousVersionsNotEmpty(): void {
  if ((TWENTY_PREVIOUS_VERSIONS as readonly string[]).length === 0) {
    throw new Error(
      "TWENTY_PREVIOUS_VERSIONS must contain at least one version before TWENTY_CURRENT_VERSION",
    );
  }
}

/**
 * Register an instance command (fast or slow) discovered via reflection.
 * Call this for every command class at startup before running upgrades.
 */
export function registerCommandInstance(
  instance: FastInstanceCommand | SlowInstanceCommand | WorkspaceCommandRunner,
  metatype: Function,
): void {
  ensureBundleMapInitialized();

  const instanceCommandMetadata = getRegisteredInstanceCommandMetadata(metatype);
  if (isDefined(instanceCommandMetadata)) {
    const bundle = bundlesByVersion.get(instanceCommandMetadata.version);
    if (!isDefined(bundle)) return;

    const entry = {
      name: computeCommandName(
        instanceCommandMetadata.version,
        metatype.name,
        instanceCommandMetadata.timestamp,
      ),
      version: instanceCommandMetadata.version,
      timestamp: instanceCommandMetadata.timestamp,
    };

    if (instanceCommandMetadata.type === "slow") {
      bundle.slowInstanceCommands.push({
        ...entry,
        command: instance as SlowInstanceCommand,
      });
    } else {
      bundle.fastInstanceCommands.push({
        ...entry,
        command: instance as FastInstanceCommand,
      });
    }
    return;
  }

  const workspaceCommandMetadata = getRegisteredWorkspaceCommandMetadata(metatype);
  if (isDefined(workspaceCommandMetadata)) {
    const bundle = bundlesByVersion.get(workspaceCommandMetadata.version);
    if (!isDefined(bundle)) return;

    bundle.workspaceCommands.push({
      name: computeCommandName(
        workspaceCommandMetadata.version,
        metatype.name,
        workspaceCommandMetadata.timestamp,
      ),
      command: instance as WorkspaceCommandRunner,
      version: workspaceCommandMetadata.version,
      timestamp: workspaceCommandMetadata.timestamp,
    });
  }
}

/**
 * Sort and validate all registered commands.
 * Call once after all registerCommandInstance() calls are done.
 */
export function finalizeCommandRegistry(): void {
  ensureBundleMapInitialized();

  for (const [, bundle] of bundlesByVersion) {
    bundle.fastInstanceCommands.sort((a, b) => a.timestamp - b.timestamp);
    bundle.slowInstanceCommands.sort((a, b) => a.timestamp - b.timestamp);
    bundle.workspaceCommands.sort((a, b) => a.timestamp - b.timestamp);
  }

  validateNoVersionDuplicatesAcrossConstants();
  validatePreviousVersionsNotEmpty();
  validateNoDuplicates();
  validateAtLeastOneVersionBundleHasWorkspaceCommands();

  for (const [version, bundle] of bundlesByVersion) {
    const totalCount =
      bundle.fastInstanceCommands.length +
      bundle.slowInstanceCommands.length +
      bundle.workspaceCommands.length;

    if (totalCount > 0) {
      const crossUpgradeLabel = (
        TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS as readonly string[]
      ).includes(version)
        ? "cross-upgrade supported"
        : "pre-release";

      console.log(
        `[UpgradeCommandRegistry] Registered ${bundle.fastInstanceCommands.length} fast instance, ${bundle.slowInstanceCommands.length} slow instance, and ${bundle.workspaceCommands.length} workspace command(s) for ${version} (${crossUpgradeLabel})`,
      );
    }
  }
}

export function getBundleForVersion(version: TwentyAllVersion): VersionBundle {
  ensureBundleMapInitialized();
  return bundlesByVersion.get(version) ?? buildEmptyVersionBundle();
}

export function getLastWorkspaceCommandForVersion(
  version: TwentyAllVersion,
): RegisteredWorkspaceCommand | undefined {
  const bundle = getBundleForVersion(version);
  return bundle.workspaceCommands[bundle.workspaceCommands.length - 1];
}

export function getCrossUpgradeSupportedFastInstanceCommands(): RegisteredFastInstanceCommand[] {
  ensureBundleMapInitialized();
  return (TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS as readonly string[]).flatMap(
    (version) =>
      getBundleForVersion(version as TwentyAllVersion).fastInstanceCommands,
  );
}

export function getCrossUpgradeSupportedSlowInstanceCommands(): RegisteredSlowInstanceCommand[] {
  ensureBundleMapInitialized();
  return (TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS as readonly string[]).flatMap(
    (version) =>
      getBundleForVersion(version as TwentyAllVersion).slowInstanceCommands,
  );
}
