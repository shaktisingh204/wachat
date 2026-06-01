import { z } from "zod";

// PORT-NOTE: Originally from twenty-server (class-validator @IsEnum decorator).
// Ported to a plain TypeScript type + Zod schema. No NestJS decorators needed.

export type AgentResponseFormatText = {
  type: "text";
};

export const AgentResponseFormatTextSchema = z.object({
  type: z.literal("text"),
});
