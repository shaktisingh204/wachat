import { PermissionFlagType } from "@/lib/sabcrm/shared/src/constants/permission-flag-type";

export const OBJECTS_WITH_SETTINGS_PERMISSIONS_REQUIREMENTS = {
  apiKey: PermissionFlagType.API_KEYS_AND_WEBHOOKS,
  webhook: PermissionFlagType.API_KEYS_AND_WEBHOOKS,
} as const;
