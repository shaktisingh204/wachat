import { z } from "zod";

import {
  searchRecordDtoSchema,
  type SearchRecordDTO,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/dtos/search-record.dto";

// PORT-NOTE: NestJS GraphQL @ObjectType() removed; plain TS type + Zod schema provided.

export const searchResultEdgeDtoSchema = z.object({
  node: searchRecordDtoSchema,
  cursor: z.string(),
});

export type SearchResultEdgeDTO = {
  node: SearchRecordDTO;
  cursor: string;
};
