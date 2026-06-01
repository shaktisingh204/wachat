import { z } from 'zod';

// PORT-NOTE: Ported from NestJS @InputType CreateConnectedAccountInput.

export type CreateConnectedAccountInput = {
  id?: string;
  handle: string;
  provider: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
  userWorkspaceId: string;
};

export const CreateConnectedAccountInputSchema = z.object({
  id: z.string().uuid().optional(),
  handle: z.string().min(1),
  provider: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  userWorkspaceId: z.string().uuid(),
});
