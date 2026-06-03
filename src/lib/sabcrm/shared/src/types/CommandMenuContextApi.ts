import { type ContextStorePageType } from '@/lib/sabcrm/shared/src/types/ContextStorePageType';
import { type ObjectPermissions } from '@/lib/sabcrm/shared/src/types/ObjectPermissions';
import { type ObjectRecord } from '@/lib/sabcrm/shared/src/types/ObjectRecord';

export type CommandMenuContextApi = {
  pageType: ContextStorePageType;
  isInSidePanel: boolean;
  isDashboardPageLayoutInEditMode: boolean;
  isLayoutCustomizationModeEnabled: boolean;
  favoriteRecordIds: string[];
  isSelectAll: boolean;
  hasAnySoftDeleteFilterOnView: boolean;
  numberOfSelectedRecords: number;
  objectPermissions: ObjectPermissions & { objectMetadataId: string };
  selectedRecords: ObjectRecord[];
  featureFlags: Record<string, boolean>;
  permissionFlags: Record<string, boolean>;
  targetObjectReadPermissions: Record<string, boolean>;
  targetObjectWritePermissions: Record<string, boolean>;
  canImpersonate: boolean;
  canAccessFullAdminPanel: boolean;
  objectMetadataItem: Record<string, unknown>;
  objectMetadataLabel: string;
};
