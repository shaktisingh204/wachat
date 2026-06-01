import { z } from 'zod';

import { CommandMenuItemAvailabilityType } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/command-menu-item-availability-type.enum';
import { EngineComponentKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';

export const CreateCommandMenuItemInputSchema = z.object({
  workflowVersionId: z.string().uuid().optional(),
  frontComponentId: z.string().uuid().optional(),
  engineComponentKey: z.nativeEnum(EngineComponentKey),
  label: z.string().min(1),
  icon: z.string().optional(),
  shortLabel: z.string().optional(),
  position: z.number().optional(),
  isPinned: z.boolean().optional(),
  availabilityType: z.nativeEnum(CommandMenuItemAvailabilityType).optional(),
  hotKeys: z.array(z.string()).optional(),
  conditionalAvailabilityExpression: z.string().optional(),
  availabilityObjectMetadataId: z.string().uuid().optional(),
  // payload is a freeform JSON object (PathCommandMenuItemPayload | ObjectMetadataCommandMenuItemPayload)
  payload: z.record(z.unknown()).optional(),
  pageLayoutId: z.string().uuid().optional(),
});

export type CreateCommandMenuItemInput = z.infer<typeof CreateCommandMenuItemInputSchema>;
