// PORT-NOTE: Barrel re-export of all ported SSO DTOs.
// NestJS @InputType/@ObjectType decorators stripped; plain TS types + zod
// schemas exported. class-validator decorators replaced with zod validation.

import { z } from 'zod';

import {
  IdentityProviderType,
  SSOIdentityProviderStatus,
} from '@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity';
import { type SSOConfiguration } from '@/lib/sabcrm/server/src/engine/core-modules/sso/types/SSOConfigurations.type';

// ── delete-sso ───────────────────────────────────────────────────────────────

export type DeleteSsoInput = {
  identityProviderId: string;
};

export const DeleteSsoInputSchema = z.object({
  identityProviderId: z.string().uuid(),
});

export type DeleteSsoDTO = {
  identityProviderId: string;
};

// ── edit-sso ─────────────────────────────────────────────────────────────────

export type EditSsoInput = {
  id: string;
  status: SSOConfiguration['status'];
};

export const EditSsoInputSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(SSOIdentityProviderStatus),
});

export type EditSsoDTO = {
  id: string;
  type: string;
  issuer: string;
  name: string;
  status: SSOConfiguration['status'];
};

// ── find-available-SSO-IDP ───────────────────────────────────────────────────

export type WorkspaceNameAndId = {
  displayName?: string | null;
  id: string;
};

export type FindAvailableSSOIDPDTO = {
  type: SSOConfiguration['type'];
  id: string;
  issuer: string;
  name: string;
  status: SSOConfiguration['status'];
  workspace: WorkspaceNameAndId;
};

// ── setup-sso ────────────────────────────────────────────────────────────────

export type SetupSsoDTO = {
  id: string;
  type: IdentityProviderType;
  issuer: string;
  name: string;
  status: SSOConfiguration['status'];
};

export type SetupOIDCSsoInput = {
  name: string;
  issuer: string;
  clientID: string;
  clientSecret: string;
};

export const SetupOIDCSsoInputSchema = z.object({
  name: z.string(),
  issuer: z.string().url(),
  clientID: z.string(),
  clientSecret: z.string(),
});

export type SetupSAMLSsoInput = {
  id: string;
  name: string;
  issuer: string;
  ssoURL: string;
  certificate: string;
  fingerprint?: string;
};

export const SetupSAMLSsoInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  issuer: z.string().url(),
  ssoURL: z.string().url(),
  certificate: z.string().min(1),
  fingerprint: z.string().optional(),
});
