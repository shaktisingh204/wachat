// PORT-NOTE: dto — @nestjs/graphql ObjectType decorators removed; exported as
// plain TypeScript types. The NestJS GraphQL schema is not reproduced in Next.js.

import { type UpgradeHealthEnum } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/dtos/upgrade-health.enum";
import { type UpgradeMigrationStatus } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-migration.entity";

export type LatestUpgradeCommandDTO = {
  name: string;
  status: UpgradeMigrationStatus;
  executedByVersion: string;
  errorMessage: string | null;
  createdAt: Date;
};

export type InstanceUpgradeStatusDTO = {
  inferredVersion: string | null;
  health: UpgradeHealthEnum;
  latestCommand: LatestUpgradeCommandDTO | null;
};
