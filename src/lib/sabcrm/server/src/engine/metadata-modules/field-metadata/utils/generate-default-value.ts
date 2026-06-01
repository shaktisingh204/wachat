// PORT-NOTE: Ported from twenty-server. NestJS / TypeORM decorators removed;
// plain TypeScript function. Import paths updated to SabNode target paths.

import { FieldActorSource } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';
import { type FieldMetadataDefaultValue } from '@/lib/sabcrm/shared/src/types/FieldMetadataDefaultValue';
import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

// Re-export type alias used by consumers
export type { FieldMetadataDefaultValue };

// No need to refactor as unused in workspace migration v2
export function generateDefaultValue(
  type: FieldMetadataType,
): FieldMetadataDefaultValue {
  switch (type) {
    case FieldMetadataType.ACTOR:
      return {
        source: `'${FieldActorSource.MANUAL}'`,
        name: "'System'",
        workspaceMemberId: null,
      } satisfies FieldMetadataDefaultValue<FieldMetadataType.ACTOR>;
    default:
      return null;
  }
}
