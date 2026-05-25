import { z } from 'zod';

export const voice_call_schema = z.object({
  caller: z.string().min(1, "caller is required"),
  durationSeconds: z.coerce.number(),
  status: z.enum(['completed', 'missed', 'voicemail'])
});

export type VoiceCallType = z.infer<typeof voice_call_schema> & { _id: string; createdAt: Date; updatedAt: Date };
