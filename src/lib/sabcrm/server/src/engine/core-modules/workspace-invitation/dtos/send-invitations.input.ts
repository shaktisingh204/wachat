import { z } from "zod";

export const sendInvitationsInputSchema = z.object({
  emails: z
    .array(z.string().email())
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Emails must be unique",
    }),
  roleId: z.string().uuid().nullable().optional(),
});

export type SendInvitationsInput = z.infer<typeof sendInvitationsInputSchema>;
