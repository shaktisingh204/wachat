import { z } from 'zod';

import {
  ConnectedAccountDTOSchema,
  type ConnectedAccountDTO,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/dtos/connected-account.dto';

// PORT-NOTE: Ported from NestJS @ObjectType ConnectedAccountPublicDTO which extends
// OmitType(ConnectedAccountDTO, ['connectionParameters']).
// The public DTO exposes only the host/port/username/secure subset — no passwords.

export type PublicConnectionParameters = {
  host: string;
  port: number;
  username?: string;
  secure?: boolean;
};

export type PublicImapSmtpCaldavConnectionParameters = {
  IMAP?: PublicConnectionParameters;
  SMTP?: PublicConnectionParameters;
  CALDAV?: PublicConnectionParameters;
};

export type ConnectedAccountPublicDTO = Omit<
  ConnectedAccountDTO,
  'connectionParameters'
> & {
  connectionParameters: PublicImapSmtpCaldavConnectionParameters | null;
};

const PublicConnectionParametersSchema = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string().optional(),
  secure: z.boolean().optional(),
});

const PublicImapSmtpCaldavSchema = z.object({
  IMAP: PublicConnectionParametersSchema.optional(),
  SMTP: PublicConnectionParametersSchema.optional(),
  CALDAV: PublicConnectionParametersSchema.optional(),
});

export const ConnectedAccountPublicDTOSchema = ConnectedAccountDTOSchema.omit({
  connectionParameters: true,
}).extend({
  connectionParameters: PublicImapSmtpCaldavSchema.nullable(),
});
