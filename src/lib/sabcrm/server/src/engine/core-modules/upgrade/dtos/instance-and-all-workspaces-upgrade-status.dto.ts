// PORT-NOTE: dto — @nestjs/graphql ObjectType decorators removed; exported as
// plain TypeScript type.

import { type InstanceUpgradeStatusDTO } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/dtos/instance-upgrade-status.dto";
import { type WorkspaceUpgradeRefDTO } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/dtos/workspace-upgrade-ref.dto";

export type InstanceAndAllWorkspacesUpgradeStatusDTO = {
  instanceUpgradeStatus: InstanceUpgradeStatusDTO;
  workspacesBehind: WorkspaceUpgradeRefDTO[];
  workspacesFailed: WorkspaceUpgradeRefDTO[];
  upToDateWorkspaceCount: number;
  computedAt: Date;
};
