import { z } from 'zod';

export const document_e_signatures_schema = z.object({
  documentName: z.string().min(1, "documentName is required"),
  signerEmail: z.string().min(1, "signerEmail is required"),
  status: z.enum(['pending', 'signed', 'declined'])
});

export type DocumentESignaturesType = z.infer<typeof document_e_signatures_schema> & { _id: string; createdAt: Date; updatedAt: Date };
