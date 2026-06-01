import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

import type { FileOutput } from './file-item.type';

export const isFileOutputArray = (value: unknown): value is FileOutput[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (item): item is FileOutput =>
        isDefined(item) &&
        typeof item === 'object' &&
        'fileId' in item &&
        typeof (item as Record<string, unknown>).fileId === 'string' &&
        'label' in item &&
        typeof (item as Record<string, unknown>).label === 'string' &&
        'extension' in item &&
        typeof (item as Record<string, unknown>).extension === 'string',
    )
  );
};
