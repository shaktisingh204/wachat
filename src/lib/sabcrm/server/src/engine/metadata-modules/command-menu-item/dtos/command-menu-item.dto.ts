// PORT-NOTE: NestJS GraphQL @ObjectType decorators removed; file is now a plain TS type.

import type { CommandMenuItemPayload } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/command-menu-item-payload.union';
import { CommandMenuItemAvailabilityType } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/command-menu-item-availability-type.enum';
import { EngineComponentKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';

export type FrontComponentDTO = {
  id: string;
  [key: string]: unknown;
};

export type CommandMenuItemDTO = {
  id: string;
  workflowVersionId?: string;
  frontComponentId?: string;
  frontComponent?: FrontComponentDTO | null;
  engineComponentKey: EngineComponentKey;
  label: string;
  icon?: string;
  shortLabel?: string;
  position: number;
  isPinned: boolean;
  availabilityType: CommandMenuItemAvailabilityType;
  payload?: CommandMenuItemPayload;
  hotKeys?: string[];
  conditionalAvailabilityExpression?: string;
  availabilityObjectMetadataId?: string;
  pageLayoutId?: string;
  /** Hidden from public API */
  workspaceId: string;
  universalIdentifier?: string;
  applicationId?: string;
  createdAt: Date;
  updatedAt: Date;
};
