import { z } from "zod";

// PORT-NOTE: NestJS GraphQL @ObjectType() removed; plain TS type + Zod schema provided.

export const searchResultPageInfoDtoSchema = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

export type SearchResultPageInfoDTO = {
  endCursor: string | null;
  hasNextPage: boolean;
};
