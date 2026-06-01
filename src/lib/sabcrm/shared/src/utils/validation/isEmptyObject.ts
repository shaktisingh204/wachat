export const isEmptyObject = (obj: Record<string, unknown> | object): boolean => {
  return typeof obj === 'object' && obj !== null && Object.keys(obj).length === 0;
};
