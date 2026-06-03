import { type FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';
import { type FilterableAndTSVectorFieldType } from '@/lib/sabcrm/shared/src/types/FilterableFieldType';
import { type ViewFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';
import { isEmptinessOperand } from '@/lib/sabcrm/shared/src/utils/filter/isEmptinessOperand';
import { getFilterTypeFromFieldType } from '@/lib/sabcrm/shared/src/utils/filter/utils/getFilterTypeFromFieldType';

export const checkIfShouldComputeEmptinessFilter = ({
  recordFilterOperand,
  correspondingFieldMetadataItem,
}: {
  recordFilterOperand: ViewFilterOperand;
  correspondingFieldMetadataItem: { type: FieldMetadataType };
}) => {
  const isAnEmptinessOperand = isEmptinessOperand(recordFilterOperand);

  if (!isAnEmptinessOperand) {
    return false;
  }

  const filterTypesThatHaveNoEmptinessOperand: FilterableAndTSVectorFieldType[] =
    ['BOOLEAN', 'TS_VECTOR'];

  const filterType = getFilterTypeFromFieldType(
    correspondingFieldMetadataItem.type,
  );

  const filterHasEmptinessOperands =
    !filterTypesThatHaveNoEmptinessOperand.includes(filterType);

  return filterHasEmptinessOperands === true;
};
