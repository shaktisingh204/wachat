// PORT-NOTE: Ported from twenty-server AgentMessagePartDTO.
// NestJS GraphQL @ObjectType/@Field decorators removed.
// Exported as a plain TypeScript type. Validation is enforced via zod schema.

import { z } from "zod";

export const AgentMessagePartDTOSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  orderIndex: z.number().int(),
  type: z.string(),
  textContent: z.string().nullable(),
  reasoningContent: z.string().nullable(),
  toolName: z.string().nullable(),
  toolCallId: z.string().nullable(),
  toolInput: z.unknown().nullable(),
  toolOutput: z.unknown().nullable(),
  state: z.string().nullable(),
  providerExecuted: z.boolean().nullable(),
  errorMessage: z.string().nullable(),
  errorDetails: z.record(z.unknown()).nullable(),
  sourceUrlSourceId: z.string().nullable(),
  sourceUrlUrl: z.string().nullable(),
  sourceUrlTitle: z.string().nullable(),
  sourceDocumentSourceId: z.string().nullable(),
  sourceDocumentMediaType: z.string().nullable(),
  sourceDocumentTitle: z.string().nullable(),
  sourceDocumentFilename: z.string().nullable(),
  fileMediaType: z.string().nullable(),
  fileFilename: z.string().nullable(),
  fileId: z.string().uuid().nullable(),
  fileUrl: z.string().nullable(),
  providerMetadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
});

export type AgentMessagePartDTO = z.infer<typeof AgentMessagePartDTOSchema>;
