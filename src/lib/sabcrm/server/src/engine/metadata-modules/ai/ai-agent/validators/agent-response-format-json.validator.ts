import { z } from "zod";

// PORT-NOTE: Originally from twenty-server (class-validator @IsEnum/@IsObject decorators).
// Ported to a plain TypeScript type + Zod schema. No NestJS decorators needed.

export type AgentResponseFormatJson = {
  type: "json";
  schema: Record<string, unknown>;
};

export const AgentResponseFormatJsonSchema = z.object({
  type: z.literal("json"),
  schema: z.record(z.unknown()).refine(
    (val) => val !== null && typeof val === "object" && Object.keys(val).length > 0,
    { message: "schema must be a non-empty object" },
  ),
});
