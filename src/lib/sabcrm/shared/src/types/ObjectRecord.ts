// PORT-NOTE: Original used an interface with [key: string]: any for dynamic record fields.
// Kept as interface to match original — dynamic indexer requires 'any' here.
export interface ObjectRecord {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
