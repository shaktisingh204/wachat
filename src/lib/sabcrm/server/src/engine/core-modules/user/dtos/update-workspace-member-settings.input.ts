import { z } from "zod";

// PORT-NOTE: NestJS @InputType GraphQL input → TypeScript type + Zod schema.
// graphql-type-json's GraphQLJSON field mapped to z.record(z.unknown()).

export const UpdateWorkspaceMemberSettingsInputSchema = z.object({
  workspaceMemberId: z.string().uuid(),
  update: z.record(z.unknown()),
});

export type UpdateWorkspaceMemberSettingsInput = z.infer<
  typeof UpdateWorkspaceMemberSettingsInputSchema
>;
