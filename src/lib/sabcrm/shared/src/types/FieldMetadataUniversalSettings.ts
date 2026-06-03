import { type FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';
import { type FieldMetadataSettings } from '@/lib/sabcrm/shared/src/types/FieldMetadataSettings';
import { type FormatRecordSerializedRelationProperties } from '@/lib/sabcrm/shared/src/types/FormatRecordSerializedRelationProperties.type';

export type FieldMetadataUniversalSettings<
  T extends FieldMetadataType = FieldMetadataType,
> = FormatRecordSerializedRelationProperties<FieldMetadataSettings<T>>;
