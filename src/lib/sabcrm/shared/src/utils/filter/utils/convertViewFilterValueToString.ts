// PORT-NOTE: source uses `any` deliberately for a universal JSON serialiser
export const convertViewFilterValueToString = (value: unknown) => {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
};
