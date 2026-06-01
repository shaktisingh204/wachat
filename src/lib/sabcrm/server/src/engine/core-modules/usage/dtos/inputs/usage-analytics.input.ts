/* @license Enterprise */

// PORT-NOTE: NestJS @InputType / @Field GraphQL decorators removed.
// Ported to a plain TypeScript type + Zod schema for validation.

import { z } from "zod";
import { UsageOperationType } from "@/lib/sabcrm/server/src/engine/core-modules/usage/enums/usage-operation-type.enum";

export type UsageAnalyticsInput = {
  periodStart?: Date;
  periodEnd?: Date;
  userWorkspaceId?: string;
  operationTypes?: UsageOperationType[];
};

export const UsageAnalyticsInputSchema = z.object({
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  userWorkspaceId: z.string().optional(),
  operationTypes: z
    .array(z.nativeEnum(UsageOperationType))
    .optional(),
});
