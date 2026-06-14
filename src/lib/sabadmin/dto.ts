import type { EffectivePermissionMap } from '@/lib/rbac';
import type { ProvisionStatus, UsernameConvention, DomainMode } from './types';

/**
 * Serializable DTOs shared between SabAdmin server actions and the console UI.
 * Kept out of the `'use server'` action files (whose runtime exports must all
 * be async functions) and out of `types.ts` (which holds the Mongo doc shapes).
 */

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** Input to the onboarding ("Add employee") flow. */
export interface OnboardEmployeeInput {
  firstName: string;
  lastName: string;
  /** Local-part of the mailbox / UPN (already derived or edited in the wizard). */
  localPart: string;
  /** A verified domain in the org's mail workspace. */
  domain: string;
  /** Optional admin-set password; a strong one is generated when omitted. */
  password?: string;
  /** Catalog app ids to grant. */
  appIds?: string[];
  /** Access Package ids to apply. */
  packageIds?: string[];
  departmentId?: string;
  designationId?: string;
  reportingManagerId?: string;
  /** ISO date string. */
  dateOfJoining?: string;
  phone?: string;
  quotaMb?: number;
  /** Optional alternate address to email the welcome + credentials to. */
  notifyEmail?: string;
}

/** Returned once on a successful onboard — the M365 "credentials card". */
export interface OnboardCredentials {
  upn: string;
  oneTimePassword: string;
  displayName: string;
  userId: string;
  employeeId: string;
  grantedApps: string[];
}

/** A person row for the console People table. */
export interface PersonRow {
  userId: string;
  employeeId: string | null;
  upn: string;
  displayName: string;
  status: ProvisionStatus;
  mailboxStatus: string | null;
  grantedApps: string[];
  packageIds: string[];
  createdAt: string | null;
}

/** Settings shape surfaced to the console (serializable). */
export interface SettingsView {
  ownerUserId: string;
  mailWorkspaceId: string | null;
  domainMode: DomainMode;
  sharedDomain: string | null;
  orgSlug: string | null;
  usernameConvention: UsernameConvention;
  defaultPackageId: string | null;
  /** Project provisioned employees are stamped into for SabCRM People visibility. */
  sabcrmProjectId: string | null;
  /** The owner's projects (id + name) — choices for the SabCRM-project picker. */
  projects: Array<{ id: string; name: string }>;
  /** Verified domains available for provisioning (resolved from the mail workspace). */
  verifiedDomains: string[];
  /** Best-guess default domain per the "custom-else-shared" policy. */
  defaultDomain: string | null;
  /** Whether hosted mail (Stalwart) is configured on the server. */
  hostedMailConfigured: boolean;
  /** Whether Firebase Auth (login provisioning) is configured. */
  hostedAuthConfigured: boolean;
}

/** An Access Package row for the console. */
export interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  apps: string[];
  permissions: EffectivePermissionMap;
  createdAt: string | null;
}

/** A grantable app option for the wizard / package editor (granter-bounded). */
export interface GrantableAppOption {
  appId: string;
  label: string;
}

/** One row of a bulk onboard (CSV). */
export interface BulkOnboardRow {
  firstName: string;
  lastName: string;
  localPart?: string;
  domain: string;
  appIds?: string[];
  packageIds?: string[];
}

/** Per-row outcome of a bulk onboard. */
export interface BulkOnboardResult {
  ok: boolean;
  displayName: string;
  upn?: string;
  oneTimePassword?: string;
  error?: string;
}
