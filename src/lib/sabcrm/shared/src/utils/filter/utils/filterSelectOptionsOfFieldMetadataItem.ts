import { type PartialFieldMetadataItem } from '@/lib/sabcrm/shared/src/types/PartialFieldMetadataItem';

export const filterSelectOptionsOfFieldMetadataItem = ({
  fieldMetadataItem,
  filterValue,
}: {
  fieldMetadataItem: PartialFieldMetadataItem;
  filterValue: string;
}) => {
  const selectOptions = fieldMetadataItem.options;

  const foundCorrespondingSelectOptions = selectOptions?.filter(
    (selectOption) =>
      selectOption.value
        .toLocaleLowerCase()
        .includes(filterValue.toLocaleLowerCase()) ||
      selectOption.label
        .toLocaleLowerCase()
        .includes(filterValue.toLocaleLowerCase()),
  );

  return {
    foundCorrespondingSelectOptions,
  };
};
