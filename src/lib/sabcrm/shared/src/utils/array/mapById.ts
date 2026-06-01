/**
 * Maps an item with an `id` field to its `id` value.
 * Useful as an Array.map callback to extract ids.
 */
export const mapById = <T extends { id: string }>(itemToMap: T): string => {
  return itemToMap.id;
};
