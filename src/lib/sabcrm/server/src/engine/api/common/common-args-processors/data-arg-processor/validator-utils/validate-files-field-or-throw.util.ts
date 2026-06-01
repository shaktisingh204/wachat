import { inspect } from 'util';

import { isNull } from '@sniptt/guards';
import {
  type FieldMetadataSettingsMapping,
  type FieldMetadataType,
} from 'src/lib/sabcrm/shared/src/types/index';
import { z } from 'zod';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export type FileInput = {
  fileId: string;
  label: string;
};

const fileItemSchema = z
  .object({
    fileId: z.string().uuid(),
    label: z.string(),
  })
  .strict();

export const filesFieldSchema = z.array(fileItemSchema);

export const validateFilesFieldOrThrow = (
  value: unknown,
  fieldName: string,
  settings: FieldMetadataSettingsMapping[FieldMetadataType & 'FILES'],
): FileInput[] | null => {
  if (isNull(value)) return null;

  let parsedValue: unknown = value;

  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      const inspectedValue = inspect(value);

      throw new CommonQueryRunnerException(
        `Invalid value "${inspectedValue}" for FILES field "${fieldName}" - It should be an array of objects with "fileId" and "label" properties.`,
        CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
        {
          userFriendlyMessage: `Invalid value "${inspectedValue}" for FILES field "${fieldName}" - It should be an array of objects with "fileId" and "label" properties.`,
        },
      );
    }
  }

  const result = filesFieldSchema.safeParse(parsedValue);

  if (!result.success) {
    const inspectedValue = inspect(parsedValue);
    const errorMessage = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    throw new CommonQueryRunnerException(
      `Invalid value "${inspectedValue}" for FILES field "${fieldName}" - ${errorMessage}`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      {
        userFriendlyMessage: `Invalid value for FILES field "${fieldName}" - ${errorMessage}`,
      },
    );
  }

  if (settings && result.data.length > settings.maxNumberOfValues) {
    const maxNumberOfValues = settings.maxNumberOfValues;

    throw new CommonQueryRunnerException(
      `Max number of files is ${maxNumberOfValues} for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      {
        userFriendlyMessage: `Max number of files is ${maxNumberOfValues} for field "${fieldName}"`,
      },
    );
  }

  return result.data;
};
