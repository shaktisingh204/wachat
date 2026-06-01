import { type STANDARD_OBJECTS } from '@/lib/sabcrm/shared/src/metadata/constants/standard-object.constant';

export const DEFAULT_RELATIONS_OBJECTS_STANDARD_IDS = [
  'timelineActivity',
  'attachment',
  'noteTarget',
  'taskTarget',
] as const satisfies (keyof typeof STANDARD_OBJECTS)[];
