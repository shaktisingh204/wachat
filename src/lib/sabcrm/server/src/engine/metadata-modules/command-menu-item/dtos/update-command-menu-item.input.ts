import { z } from 'zod';

import { CommandMenuItemAvailabilityType } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/command-menu-item-availability-type.enum';
import { EngineComponentKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';

export const UpdateCommandMenuItemInputSchema = z.object({
  id: z.string().uuid(),
  label: z.string().optional(),
  icon: z.string().optional(),
  shortLabel: z.string().optional(),
  position: z.number().optional(),
  isPinned: z.boolean().optional(),
  availabilityType: z.nativeEnum(CommandMenuItemAvailabilityType).optional(),
  availabilityObjectMetadataId: z.string().uuid().optional(),
  engineComponentKey: z.nativeEnum(EngineComponentKey).optional(),
  hotKeys: z.array(z.string()).optional(),
  pageLayoutId: z.string().uuid().optional(),
});

export type UpdateCommandMenuItemInput = z.infer<typeof UpdateCommandMenuItemInputSchema>;
