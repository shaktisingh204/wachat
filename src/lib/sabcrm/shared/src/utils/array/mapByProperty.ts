/**
 * Returns a mapper function that extracts the given property from an object.
 * Useful as a curried Array.map callback.
 */
export const mapByProperty =
  <T extends { id: string }>(propertyName: keyof T) =>
  (itemToMap: T): T[keyof T] => {
    return itemToMap[propertyName];
  };
