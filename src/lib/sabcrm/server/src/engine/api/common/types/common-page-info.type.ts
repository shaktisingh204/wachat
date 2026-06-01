// PORT-NOTE: In the original, CommonPageInfo derives NonNullable from PageInfo
// which comes from the REST handler. In the Mongo port we define the type
// directly since the REST handler is not ported.

export type CommonPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};
