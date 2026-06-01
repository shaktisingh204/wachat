// PORT-NOTE: dto — @nestjs/graphql ObjectType decorators removed; exported as
// plain TypeScript type.

import { type LatestUpgradeCommandDTO } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/dtos/instance-upgrade-status.dto";
import { type UpgradeHealthEnum } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/dtos/upgrade-health.enum";

export type WorkspaceUpgradeStatusDTO = {
  workspaceId: string;
  displayName: string | null;
  inferredVersion: string | null;
  health: UpgradeHealthEnum;
  latestCommand: LatestUpgradeCommandDTO | null;
};
