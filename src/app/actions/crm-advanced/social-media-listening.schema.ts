import { z } from 'zod';

export const social_media_listening_schema = z.object({
  platform: z.string().min(1, "platform is required"),
  keyword: z.string().min(1, "keyword is required"),
  sentiment: z.enum(['positive', 'neutral', 'negative'])
});

export type SocialMediaListeningType = z.infer<typeof social_media_listening_schema> & { _id: string; createdAt: Date; updatedAt: Date };
