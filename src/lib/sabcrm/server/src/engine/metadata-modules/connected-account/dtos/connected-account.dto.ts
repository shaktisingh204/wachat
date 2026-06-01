import { z } from 'zod';

// PORT-NOTE: Ported from NestJS @ObjectType ConnectedAccountDTO.
// HideField() fields (accessToken, refreshToken, connectionParameters, oidcTokenClaims, workspaceId)
// are present on the type but must NOT be sent to clients; callers must strip them.

export type ImapSmtpCaldavParams = {
  IMAP?: ConnectionParameters;
  SMTP?: ConnectionParameters;
  CALDAV?: ConnectionParameters;
};

export type ConnectionParameters = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  secure?: boolean;
};

export type ConnectedAccountDTO = {
  id: string;
  handle: string;
  provider: string;
  /** Hidden from clients — strip before sending */
  accessToken: string | null;
  /** Hidden from clients — strip before sending */
  refreshToken: string | null;
  lastCredentialsRefreshedAt: Date | null;
  authFailedAt: Date | null;
  handleAliases: string[] | null;
  scopes: string[] | null;
  /** Hidden from clients — strip before sending */
  connectionParameters: ImapSmtpCaldavParams | null;
  lastSignedInAt: Date | null;
  /** Hidden from clients — strip before sending */
  oidcTokenClaims: Record<string, unknown> | null;
  userWorkspaceId: string;
  connectionProviderId: string | null;
  applicationId: string | null;
  name: string | null;
  /** 'user' = private, 'workspace' = shared with all members */
  visibility: string;
  /** Hidden from clients — strip before sending */
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
};

export const ConnectedAccountDTOSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().min(1),
  provider: z.string().min(1),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  lastCredentialsRefreshedAt: z.coerce.date().nullable(),
  authFailedAt: z.coerce.date().nullable(),
  handleAliases: z.array(z.string()).nullable(),
  scopes: z.array(z.string()).nullable(),
  connectionParameters: z.unknown().nullable(),
  lastSignedInAt: z.coerce.date().nullable(),
  oidcTokenClaims: z.record(z.unknown()).nullable(),
  userWorkspaceId: z.string().uuid(),
  connectionProviderId: z.string().uuid().nullable(),
  applicationId: z.string().uuid().nullable(),
  name: z.string().nullable(),
  visibility: z.string(),
  workspaceId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
