import { z } from "zod";

// PORT-NOTE: NestJS GraphQL @InputType() / @Field() decorators replaced with Zod schemas
// and plain TypeScript types. The FilterIs enum and UUID/DateTime filter types are preserved
// as plain TS types + Zod validators.

export enum FilterIs {
  NotNull = "NOT_NULL",
  Null = "NULL",
}

const filterIsSchema = z.nativeEnum(FilterIs);

const uuidFilterSchema = z.object({
  eq: z.string().uuid().optional().nullable(),
  gt: z.string().uuid().optional().nullable(),
  gte: z.string().uuid().optional().nullable(),
  in: z.array(z.string().uuid()).optional().nullable(),
  lt: z.string().uuid().optional().nullable(),
  lte: z.string().uuid().optional().nullable(),
  neq: z.string().uuid().optional().nullable(),
  is: filterIsSchema.optional().nullable(),
});

export type UUIDFilterType = z.infer<typeof uuidFilterSchema>;

const dateTimeFilterSchema = z.object({
  eq: z.coerce.date().optional().nullable(),
  gt: z.coerce.date().optional().nullable(),
  gte: z.coerce.date().optional().nullable(),
  in: z.array(z.coerce.date()).optional().nullable(),
  lt: z.coerce.date().optional().nullable(),
  lte: z.coerce.date().optional().nullable(),
  neq: z.coerce.date().optional().nullable(),
  is: filterIsSchema.optional().nullable(),
});

export type DateTimeFilterType = z.infer<typeof dateTimeFilterSchema>;

// Recursive type requires a lazy schema
const objectRecordFilterInputSchema: z.ZodType<ObjectRecordFilterInput> =
  z.lazy(() =>
    z.object({
      and: z.array(objectRecordFilterInputSchema).optional().nullable(),
      not: objectRecordFilterInputSchema.optional().nullable(),
      or: z.array(objectRecordFilterInputSchema).optional().nullable(),
      id: uuidFilterSchema.optional().nullable(),
      createdAt: dateTimeFilterSchema.optional().nullable(),
      updatedAt: dateTimeFilterSchema.optional().nullable(),
      deletedAt: dateTimeFilterSchema.optional().nullable(),
    }),
  );

export type ObjectRecordFilterInput = {
  and?: ObjectRecordFilterInput[] | null;
  not?: ObjectRecordFilterInput | null;
  or?: ObjectRecordFilterInput[] | null;
  id?: UUIDFilterType | null;
  createdAt?: DateTimeFilterType | null;
  updatedAt?: DateTimeFilterType | null;
  deletedAt?: DateTimeFilterType | null;
};

export const objectRecordFilterInputZod = objectRecordFilterInputSchema;
