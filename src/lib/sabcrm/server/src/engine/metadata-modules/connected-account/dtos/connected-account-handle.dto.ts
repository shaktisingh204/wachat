import { z } from 'zod';

// PORT-NOTE: Ported from NestJS @ObjectType. Validation via zod; UUID validated as string.

export type ConnectedAccountHandleDTO = {
  id: string;
  handle: string;
  provider: string;
};

export const ConnectedAccountHandleDTOSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().min(1),
  provider: z.string().min(1),
});
