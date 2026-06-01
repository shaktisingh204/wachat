import { z } from "zod";

import {
  searchResultEdgeDtoSchema,
  type SearchResultEdgeDTO,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/dtos/search-result-edge.dto";
import {
  searchResultPageInfoDtoSchema,
  type SearchResultPageInfoDTO,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/dtos/search-result-page-info.dto";

// PORT-NOTE: NestJS GraphQL @ObjectType() removed; plain TS type + Zod schema provided.

export const searchResultConnectionDtoSchema = z.object({
  edges: z.array(searchResultEdgeDtoSchema),
  pageInfo: searchResultPageInfoDtoSchema,
});

export type SearchResultConnectionDTO = {
  edges: SearchResultEdgeDTO[];
  pageInfo: SearchResultPageInfoDTO;
};
