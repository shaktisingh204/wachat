import { findById } from '@/lib/sabcrm/shared/src/utils/array/findById';

/**
 * Upserts an item into an array of objects by comparing `id` fields.
 * If an item with the same id exists, it is replaced; otherwise the item is appended.
 */
export const upsertIntoArrayOfObjectsComparingId = <T extends { id: string }>(
  arrayToUpsertInto: T[],
  itemToUpsert: T,
): T[] => {
  const alreadyExistingItemIndex = arrayToUpsertInto.findIndex(
    findById(itemToUpsert.id),
  );

  const shouldReplaceItem = alreadyExistingItemIndex > -1;

  if (shouldReplaceItem) {
    const newArray = [...arrayToUpsertInto];

    newArray.splice(alreadyExistingItemIndex, 1, itemToUpsert);

    return newArray;
  } else {
    return arrayToUpsertInto.concat(itemToUpsert);
  }
};
