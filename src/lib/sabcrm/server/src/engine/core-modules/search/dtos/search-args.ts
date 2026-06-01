import { z } from "zod";

import {
  objectRecordFilterInputZod,
  type ObjectRecordFilterInput,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/dtos/object-record-filter-input";

// PORT-NOTE: NestJS @ArgsType() / @Field() decorators replaced with a Zod schema
// and a plain TypeScript type. The 100-item limit on `limit` is preserved.

export const searchArgsSchema = z.object({
  searchInput: z.string(),
  limit: z.number().int().max(100, { message: "Limit cannot exceed 100 items" }),
  after: z.string().optional().nullable(),
  includedObjectNameSingulars: z.array(z.string()).optional().nullable(),
  filter: objectRecordFilterInputZod.optional().nullable(),
  excludedObjectNameSingulars: z.array(z.string()).optional().nullable(),
});

export type SearchArgs = {
  searchInput: string;
  limit: number;
  after?: string | null;
  includedObjectNameSingulars?: string[] | null;
  filter?: ObjectRecordFilterInput | null;
  excludedObjectNameSingulars?: string[] | null;
};
