/**
 * Returns a predicate that matches items by their `id` field.
 */
export const findById = <T extends { id: string }>(idToMatch: string) => {
  return (itemToFind: T): boolean => {
    return itemToFind.id === idToMatch;
  };
};
