import { type FieldActorSource } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';

import { transformRawJsonField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-raw-json-field.util';
import { transformTextField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-text-field.util';

export const transformActorField = (
  value: {
    source?: FieldActorSource | null;
    context?: object | string | null;
    name?: string | null;
    workspaceMemberId?: string | null;
  } | null,
): {
  source?: FieldActorSource | null;
  context?: object | string | null;
  name?: string | null;
  workspaceMemberId?: string | null;
} | null => {
  if (value === null) return null;

  return {
    source: value.source,
    context:
      value.context === undefined
        ? undefined
        : transformRawJsonField(value.context),
    name:
      value.name === undefined ? undefined : transformTextField(value.name),
    workspaceMemberId:
      value.workspaceMemberId === undefined
        ? undefined
        : value.workspaceMemberId,
  };
};
