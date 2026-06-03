import { type PartialFieldMetadataItem } from '@/lib/sabcrm/shared/src/types/PartialFieldMetadataItem';
import { type RecordFilter } from '@/lib/sabcrm/shared/src/utils/filter/turnRecordFilterGroupIntoGqlOperationFilter';
import { v4 } from 'uuid';

export const createAnyFieldRecordFilterBaseProperties = ({
  filterValue,
  fieldMetadataItem,
}: {
  filterValue: string;
  fieldMetadataItem: PartialFieldMetadataItem;
}): Pick<RecordFilter, 'id' | 'value' | 'fieldMetadataId'> => {
  return {
    id: v4(),
    value: filterValue,
    fieldMetadataId: fieldMetadataItem.id,
  };
};
