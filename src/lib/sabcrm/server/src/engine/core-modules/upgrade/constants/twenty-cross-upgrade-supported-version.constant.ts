import { TWENTY_CURRENT_VERSION } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant";
import { TWENTY_PREVIOUS_VERSIONS } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-previous-versions.constant";

export const TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS = [
  ...TWENTY_PREVIOUS_VERSIONS,
  TWENTY_CURRENT_VERSION,
] as const;

export type TwentyCrossUpgradeSupportedVersion =
  (typeof TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS)[number];
