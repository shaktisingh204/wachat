import { type FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';
import { type IsExactly } from '@/lib/sabcrm/shared/src/types/IsExactly';

export type TagColor =
  | 'green'
  | 'turquoise'
  | 'sky'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'gray';

export class FieldMetadataDefaultOption {
  id?: string;
  position: number = 0;
  label: string = '';
  value: string = '';
}

export class FieldMetadataComplexOption extends FieldMetadataDefaultOption {
  color: TagColor = 'gray';
}

type FieldMetadataOptionsMapping = {
  [FieldMetadataType.RATING]: FieldMetadataDefaultOption[];
  [FieldMetadataType.SELECT]: FieldMetadataComplexOption[];
  [FieldMetadataType.MULTI_SELECT]: FieldMetadataComplexOption[];
};

export type FieldMetadataOptionForAnyType =
  | null
  | FieldMetadataOptionsMapping[keyof FieldMetadataOptionsMapping];

export type FieldMetadataOptions<
  T extends FieldMetadataType = FieldMetadataType,
> =
  IsExactly<T, FieldMetadataType> extends true
    ? FieldMetadataOptionForAnyType
    : T extends keyof FieldMetadataOptionsMapping
      ? FieldMetadataOptionsMapping[T]
      : never | null;
