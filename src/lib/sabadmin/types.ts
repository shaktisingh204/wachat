import type { EffectivePermissionMap } from '@/lib/rbac';

/**
 * SabAdmin — SabNode Admin Center data model.
 *
 * A Microsoft-365-style admin console: an org owner (or elevated admin)
 * onboards an employee who gets, in one atomic flow, a LOGIN (email = the
 * company mailbox address, the UPN), an Outlook-style hosted MAILBOX, and
 * ACCESS to a suite of SabNode tools — bounded by what the granting admin
 * themselves holds. The Joiner → Mover → Leaver lifecycle is the engine.
 *
 * Every document is scoped by `ownerUserId` (the tenant owner's `users._id`
 * string). The login account itself lives in the shared `users` collection;
 * the HR record in `crm_employees`; the mailbox in `sabmail_accounts`. The
 * collections here are the thin connective tissue + governance log.
 */

/** Username derivation used when minting an employee's local-part. */
export type UsernameConvention = 'first.last' | 'flast' | 'firstlast' | 'first';

/** Whether mailboxes default to the org's own verified domain or a shared one. */
export type DomainMode = 'custom' | 'shared';

/** Per-org SabAdmin configuration (one doc per `ownerUserId`). */
export interface SabAdminSettings {
  ownerUserId: string;
  /** The `kind:'mail'` SabMail project `_id` mailboxes are provisioned into. */
  mailWorkspaceId?: string;
  /** Default domain strategy: prefer the org's verified domain, else shared. */
  domainMode: DomainMode;
  /** The shared SabNode mail domain (e.g. `sabnode.email`) when `domainMode` allows it. */
  sharedDomain?: string;
  /** Slug used to build shared-domain addresses / display. */
  orgSlug?: string;
  /** How a new employee's mailbox local-part is derived from their name. */
  usernameConvention: UsernameConvention;
  /** Default Access Package applied in the onboarding wizard. */
  defaultPackageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A license-like bundle of apps + the permissions they grant. Assigning a
 * package provisions all its tools at once. Its `permissions` are always
 * clamped to the creator's own effective set, so a package can never describe
 * access the org doesn't hold.
 */
export interface SabAdminAccessPackage {
  ownerUserId: string;
  name: string;
  description?: string;
  /** SAB app ids included (drives the dock/app-rail surface). */
  apps: string[];
  /** Resolved {moduleKey -> action -> boolean} grants. */
  permissions: EffectivePermissionMap;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Lifecycle state of a provisioned employee. */
export type ProvisionStatus = 'provisioning' | 'active' | 'suspended' | 'offboarded';

/**
 * The per-employee link record tying the login account, mailbox, HR record and
 * access grant together — the single object the console reads to render a
 * person's identity + lifecycle.
 */
export interface SabAdminProvision {
  ownerUserId: string;
  /** `crm_employees._id` (string) — the HR record. */
  employeeId?: string;
  /** `users._id` (string) — the login account. */
  userId: string;
  /** `sabmail_accounts._id` (string) — the hosted mailbox, when provisioned. */
  mailboxAccountId?: string;
  /** The login email = mailbox address (UPN). */
  upn: string;
  displayName: string;
  /** Access Packages assigned to this person. */
  packageIds: string[];
  /** The per-employee role id materialized on the owner's role-template map. */
  roleId: string;
  /** Snapshot of the granted permission matrix (for display + re-materialize). */
  grantedPermissions: EffectivePermissionMap;
  /** Apps the person was granted (for the console + dock). */
  grantedApps: string[];
  status: ProvisionStatus;
  credsIssuedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  offboardedAt?: Date;
}

/** Immutable governance log of every lifecycle action. */
export type SabAdminAuditAction =
  | 'onboard'
  | 'update_access'
  | 'reset_password'
  | 'suspend'
  | 'reactivate'
  | 'offboard'
  | 'package_create'
  | 'package_update'
  | 'package_delete'
  | 'settings_update';

export interface SabAdminAuditEntry {
  ownerUserId: string;
  actorUserId: string;
  actorEmail?: string;
  action: SabAdminAuditAction;
  /** The affected employee's login user id, when applicable. */
  subjectUserId?: string;
  subjectUpn?: string;
  summary: string;
  meta?: Record<string, unknown>;
  ts: Date;
}
