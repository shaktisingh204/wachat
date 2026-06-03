/**
 * Returns the singular or plural label for an object metadata item
 * based on the number of selected records.
 */
export const resolveObjectMetadataLabel = ({
  objectMetadataItem,
  numberOfSelectedRecords,
}: {
  objectMetadataItem: { labelSingular: string; labelPlural: string };
  numberOfSelectedRecords: number;
}): string => {
  return numberOfSelectedRecords === 1
    ? objectMetadataItem.labelSingular
    : objectMetadataItem.labelPlural;
};
