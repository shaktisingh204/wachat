import { type FieldMetadataType } from './FieldMetadataType';
import { type PartialFieldMetadataItemOption } from './PartialFieldMetadataOption';

export type PartialFieldMetadataItem = {
  id: string;
  name: string;
  type: FieldMetadataType;
  label: string;
  options?: PartialFieldMetadataItemOption[] | null;
};
