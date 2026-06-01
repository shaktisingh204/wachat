// PORT-NOTE: In Twenty, express.d.ts augmented the Express Request interface
// with NestJS/TypeORM-specific properties (workspace, user, apiKey, etc.).
// SabNode uses Next.js (App Router), not Express/NestJS — there is no
// express-serve-static-core to augment. Auth context is carried via Next.js
// server context (cookies, headers) and typed through SabNode's own auth
// middleware types. This stub preserves the type declarations as plain
// interfaces for reference; wire them into Next.js middleware as needed.

import type { WorkspaceActivationStatus } from '@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus';

// Locale keys supported by the CRM
export type AppLocaleKey = string;

// Auth provider enum (mirrors Twenty's AuthProviderEnum)
export type AuthProviderEnum =
  | 'google'
  | 'microsoft'
  | 'password'
  | 'sso'
  | 'magicLink';

// Flat workspace shape attached to requests
export type FlatWorkspace = {
  id: string;
  subdomain: string;
  displayName?: string;
  activationStatus: WorkspaceActivationStatus;
  metadataVersion?: number;
};

// Flat auth-context user shape
export type FlatAuthContextUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

// Flat API key shape
export type FlatApiKey = {
  id: string;
  name: string;
};

// Flat application shape
export type FlatApplication = {
  id: string;
  name: string;
};

// Flat user-workspace join shape
export type FlatUserWorkspace = {
  id: string;
  userId: string;
  workspaceId: string;
  role: string;
};

// Impersonation context
export type ImpersonationContext = {
  impersonatorId: string;
  impersonateeId: string;
};

// Composite request context type (use in Next.js server actions / middleware)
export type SabCrmRequestContext = {
  user?: FlatAuthContextUser | null;
  apiKey?: FlatApiKey | null;
  application?: FlatApplication | null;
  userWorkspace?: FlatUserWorkspace;
  locale: AppLocaleKey;
  workspace?: FlatWorkspace;
  workspaceId?: string;
  workspaceMetadataVersion?: number;
  workspaceMemberId?: string;
  userWorkspaceId?: string;
  authProvider?: AuthProviderEnum | null;
  impersonationContext?: ImpersonationContext;
};
