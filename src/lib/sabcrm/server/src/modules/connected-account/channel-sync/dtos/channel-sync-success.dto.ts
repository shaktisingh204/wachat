// dto: ChannelSyncSuccessDTO (GraphQL ObjectType → plain TS type + zod schema)

import { z } from "zod";

export const channelSyncSuccessSchema = z.object({
  success: z.boolean(),
});

export type ChannelSyncSuccessDTO = z.infer<typeof channelSyncSuccessSchema>;
