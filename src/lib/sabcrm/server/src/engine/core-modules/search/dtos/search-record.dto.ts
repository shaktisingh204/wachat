import { z } from "zod";

// PORT-NOTE: NestJS GraphQL @ObjectType() / @Field() decorators replaced with a Zod schema
// and a plain TypeScript type. Field-level validators (IsUUID, IsNotEmpty, IsString, IsNumber)
// are expressed as Zod refinements.

export const searchRecordDtoSchema = z.object({
  recordId: z.string().uuid(),
  objectNameSingular: z.string().min(1),
  objectLabelSingular: z.string().min(1),
  label: z.string().min(1),
  imageUrl: z.string().nullable(),
  tsRankCD: z.number(),
  tsRank: z.number(),
});

export type SearchRecordDTO = {
  recordId: string;
  objectNameSingular: string;
  objectLabelSingular: string;
  label: string;
  imageUrl: string | null;
  tsRankCD: number;
  tsRank: number;
};
