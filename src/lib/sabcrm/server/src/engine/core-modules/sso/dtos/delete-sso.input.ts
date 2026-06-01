// PORT-NOTE: Enterprise license; GraphQL @InputType dropped; zod schema added for validation.

import { z } from "zod";

export type DeleteSsoInput = {
  identityProviderId: string;
};

export const deleteSsoInputSchema = z.object({
  identityProviderId: z.string().uuid(),
});
