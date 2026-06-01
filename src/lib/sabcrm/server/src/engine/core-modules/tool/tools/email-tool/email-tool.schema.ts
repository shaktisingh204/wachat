import { z } from "zod";

// PORT-NOTE: workflowFileSchema from twenty-shared/workflow is inlined here
// since it is not yet ported to the SabNode shared path.
const workflowFileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  createdAt: z.string(),
});

const EmailRecipientsZodSchema = z.object({
  to: z
    .string()
    .describe("Comma-separated recipient email addresses (To)")
    .default(""),
  cc: z
    .string()
    .describe("Comma-separated CC email addresses")
    .optional()
    .default(""),
  bcc: z
    .string()
    .describe("Comma-separated BCC email addresses")
    .optional()
    .default(""),
});

export const EmailToolInputZodSchema = z.object({
  recipients: EmailRecipientsZodSchema.describe(
    "Recipients object with to, cc, and bcc fields (comma-separated)",
  ),
  subject: z.string().describe("The email subject line"),
  body: z.string().describe("The email body content in HTML format"),
  connectedAccountId: z
    .string()
    .uuid()
    .describe(
      "The UUID of the connected account to send the email from. Provide this only if you have it; otherwise, leave blank.",
    )
    .optional(),
  files: z
    .array(workflowFileSchema)
    .describe("Array of file objects to attach to the email")
    .optional()
    .default([]),
  inReplyTo: z
    .string()
    .describe(
      "The RFC 2822 Message-ID of an existing email to reply to. When provided, the email is sent as a reply in the same thread.",
    )
    .optional(),
});
