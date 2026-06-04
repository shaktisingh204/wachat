'use client';

/**
 * SabCRM — Members settings (`/sabcrm/settings/members`), Twenty-style.
 *
 * Two stacked surfaces, both scoped to the active project via `useProject()`:
 *
 *   1. Members roster — list of the workspace's members, each row showing
 *      avatar, name + email, workspace role, the derived SabCRM capability
 *      chip, and an inline SabCRM-role select. Data comes from
 *      `listMembersAction`; the per-member role is derived from each role's
 *      `memberIds` (via `listRolesTw`) and changed with `setRoleMemberTw`
 *      (unassign-then-assign). Owners are pinned to full access and excluded
 *      from reassignment. Each non-owner row also exposes a Remove action;
 *      because there is no SabCRM member-removal server action, that opens a
 *      dialog explaining removal is a SabNode workspace operation
 *      (Settings → Team) — the page degrades gracefully rather than calling a
 *      missing backend.
 *
 *   2. Pending invitations — the Twenty-style member INVITATION flow. An
 *      "Invite member" button opens a dialog (email + role select) that calls
 *      `createInviteTw`. The section below the roster lists pending invites
 *      (`listInvitesTw({ status: 'pending' })`) with email, role, status chip,
 *      invited-at, and Revoke / Delete actions. Because there is no email
 *      delivery yet — and no consuming acceptance route for the token — each
 *      invite surfaces its token as a copyable invite CODE (not a URL),
 *      clearly labelled as such; the in-app acceptance flow is still coming.
 *
 * Every action independently re-runs the session → project → RBAC → plan
 * pipeline server-side, so the page fails closed. States: skeleton while the
 * project / data load, "no project" notice, empty roster, error banner, and
 * graceful degradation when the engine is unreachable.
 */

import * as React from 'react';
import {
  Users,
  ShieldCheck,
  Shield,
  Eye,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Mail,
  MailX,
  X,
  Copy,
  Check,
  Trash2,
  Info,
} from 'lucide-react';

import { TwentyPageHeader, TwentyAvatar, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { CrmMember, CrmMemberRole } from '@/lib/sabcrm/members.server';
import {
  listInvitesTw,
  createInviteTw,
  revokeInviteTw,
  deleteInviteTw,
} from '@/app/actions/sabcrm-invites.actions';
import { listRolesTw, setRoleMemberTw } from '@/app/actions/sabcrm-roles.actions';
import type { SabcrmRustRole } from '@/lib/rust-client/sabcrm-roles';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './invites.css';

// ---------------------------------------------------------------------------
// Invite wire shape
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirrors the `createInviteTw` / `listInvitesTw` payload documented in the
// `@/app/actions/sabcrm-invites.actions` contract.
// ---------------------------------------------------------------------------

type InviteStatus = 'pending' | 'accepted' | 'revoked';

interface CrmInvite {
  id: string;
  email: string;
  roleId?: string;
  status: InviteStatus;
  token: string;
  invitedBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Capability descriptors
// ---------------------------------------------------------------------------

interface CapabilityInfo {
  label: string;
  Icon: React.ElementType;
}

const CAPABILITY_INFO: Record<CrmMemberRole, CapabilityInfo> = {
  admin: { label: 'Admin', Icon: ShieldCheck },
  manage: { label: 'Manager', Icon: Shield },
  view: { label: 'Viewer', Icon: Eye },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats an ISO timestamp into a short, locale-aware label; falls back to raw. */
function formatInvitedAt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(t).toISOString();
  }
}

/**
 * Returns the raw invite token as the shareable invite code.
 *
 * There is no `/sabcrm/invite/<token>` route — SabCRM invite tokens have no
 * consuming acceptance route yet — so this deliberately surfaces the token
 * itself as a copyable code rather than fabricating a dead URL.
 */
function inviteCodeFromToken(token: string): string {
  return token;
}

// ---------------------------------------------------------------------------
// Capability chip — TwentyChip only renders an optional color dot, so this
// wraps the base `.st-chip` markup to prepend the capability icon.
// ---------------------------------------------------------------------------

function CapabilityChip({ role }: { role: CrmMemberRole }): React.JSX.Element {
  const cap = CAPABILITY_INFO[role];
  const { Icon } = cap;
  return (
    <span className="st-chip">
      <Icon size={12} aria-hidden="true" />
      <span className="st-chip__label">{cap.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Copyable value — shared by the dialog success state and each invite row.
// Copies the invite CODE (the token), not a URL.
// ---------------------------------------------------------------------------

function CopyCodeButton({ value }: { value: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, [value]);
  return (
    <TwentyButton
      variant="secondary"
      icon={copied ? Check : Copy}
      onClick={copy}
      title="Copy invite code"
    >
      {copied ? 'Copied' : 'Copy'}
    </TwentyButton>
  );
}

// ---------------------------------------------------------------------------
// Invite dialog — email + role select → createInviteTw
// ---------------------------------------------------------------------------

interface InviteDialogProps {
  projectId: string;
  roles: SabcrmRustRole[];
  rolesError: boolean;
  onClose: () => void;
  onCreated: (invite: CrmInvite) => void;
}

function InviteDialog({
  projectId,
  roles,
  rolesError,
  onClose,
  onCreated,
}: InviteDialogProps): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The created invite's link, surfaced once on success.
  const [created, setCreated] = React.useState<CrmInvite | null>(null);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = email.trim();
      if (!trimmed) {
        setError('An email address is required.');
        return;
      }
      // Light client-side sanity check; the server is the source of truth.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError('Enter a valid email address.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await createInviteTw(trimmed, roleId || undefined, projectId);
        if (res.ok) {
          const invite = res.data as CrmInvite;
          onCreated(invite);
          setCreated(invite);
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to send the invitation. The service may be unavailable.');
      } finally {
        setSubmitting(false);
      }
    },
    [email, roleId, projectId, submitting, onCreated],
  );

  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Invite member"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog" style={{ maxWidth: 480 }}>
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">
            {created ? 'Invitation created' : 'Invite member'}
          </h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {created ? (
          <>
            <div className="st-dialog__body">
              <div className="st-secret">
                <span className="st-secret__label">
                  Invite code for {created.email}
                </span>
                <div className="st-invite-link__row">
                  <code className="st-secret__code">
                    {inviteCodeFromToken(created.token)}
                  </code>
                  <CopyCodeButton value={inviteCodeFromToken(created.token)} />
                </div>
                <span className="st-secret__hint">
                  Email delivery isn&apos;t wired up yet, and the in-app
                  acceptance flow is still coming. For now, copy this invite code
                  and share it with {created.email} yourself — once the
                  acceptance flow ships, they&apos;ll be able to redeem the code
                  to join the workspace.
                </span>
              </div>
            </div>
            <div className="st-dialog__footer">
              <TwentyButton variant="primary" onClick={onClose}>
                Done
              </TwentyButton>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="st-dialog__body">
              <div className="st-field">
                <label className="st-field__label" htmlFor="inv-email">
                  Email address
                  <span className="st-field__req" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="inv-email"
                  className="st-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  autoFocus
                />
              </div>

              <div className="st-field">
                <label className="st-field__label" htmlFor="inv-role">
                  Role
                </label>
                <select
                  id="inv-role"
                  className="st-select"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={rolesError}
                >
                  <option value="">No specific role (default access)</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {rolesError ? (
                  <p className="st-form-error">
                    Roles could not be loaded — the invite will use default
                    access.
                  </p>
                ) : null}
              </div>

              <div className="st-invite-callout">
                <Info className="st-invite-callout__icon" size={14} aria-hidden="true" />
                <span>
                  Email delivery isn&apos;t wired up yet and the in-app
                  acceptance flow is still coming. After creating the invitation
                  you&apos;ll get an invite code to share with the person
                  yourself.
                </span>
              </div>

              {error ? <p className="st-form-error">{error}</p> : null}
            </div>
            <div className="st-dialog__footer">
              <TwentyButton variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </TwentyButton>
              <TwentyButton type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create invitation'}
              </TwentyButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete-invite confirmation
// ---------------------------------------------------------------------------

interface DeleteInviteDialogProps {
  invite: CrmInvite;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteInviteDialog({
  invite,
  busy,
  onCancel,
  onConfirm,
}: DeleteInviteDialogProps): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete invitation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete invitation</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete the invitation for{' '}
            <strong style={{ color: 'var(--st-text)' }}>{invite.email}</strong>?
            The invite code will stop working and the record is removed. This
            cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            className="st-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete invitation'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member role select — inline per-member SabCRM role assignment.
//
// A member's current SabCRM role is the role whose `memberIds` contains the
// member's userId. Changing the selection unassigns the member from their
// previous role (if any) and assigns them to the new one via `setRoleMemberTw`.
// Degrades to a read-only label when roles can't be loaded.
// ---------------------------------------------------------------------------

interface MemberRoleSelectProps {
  member: CrmMember;
  roles: SabcrmRustRole[];
  rolesError: boolean;
  currentRoleId: string;
  busy: boolean;
  onChange: (member: CrmMember, fromRoleId: string, toRoleId: string) => void;
}

function MemberRoleSelect({
  member,
  roles,
  rolesError,
  currentRoleId,
  busy,
  onChange,
}: MemberRoleSelectProps): React.JSX.Element {
  // Owners always retain full access — their role is not reassignable here.
  if (member.isOwner) {
    return <span style={{ color: 'var(--st-text-tertiary)' }}>Owner (full access)</span>;
  }
  if (rolesError || roles.length === 0) {
    const name = currentRoleId
      ? roles.find((r) => r.id === currentRoleId)?.name ?? 'Custom role'
      : 'No role assigned';
    return <span style={{ color: 'var(--st-text-secondary)' }}>{name}</span>;
  }
  return (
    <select
      className="st-select"
      style={{ maxWidth: 200 }}
      value={currentRoleId}
      disabled={busy}
      aria-label={`SabCRM role for ${member.name.trim() || member.email}`}
      onChange={(e) => onChange(member, currentRoleId, e.target.value)}
    >
      <option value="">No role assigned</option>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Remove-member confirmation
//
// Twenty removes a member from the workspace behind a confirmation modal. There
// is no SabCRM member-removal server action yet, so this dialog degrades
// gracefully: it explains that removal is managed centrally in SabNode
// workspace settings and offers no destructive call.
// ---------------------------------------------------------------------------

interface RemoveMemberDialogProps {
  member: CrmMember;
  onCancel: () => void;
}

function RemoveMemberDialog({
  member,
  onCancel,
}: RemoveMemberDialogProps): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Remove member"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Remove member from workspace</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Removing{' '}
            <strong style={{ color: 'var(--st-text)' }}>
              {member.name.trim() || member.email}
            </strong>{' '}
            from the workspace is managed centrally in SabNode workspace settings
            (Settings → Team), alongside billing and access. Open Team settings
            there to remove this person; their SabCRM access is revoked
            automatically once they leave the workspace.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="primary" onClick={onCancel}>
            Got it
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function RowsSkeleton({ count = 4 }: { count?: number }): React.JSX.Element {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending invitations section
// ---------------------------------------------------------------------------

interface PendingInvitesProps {
  invites: CrmInvite[];
  loading: boolean;
  error: string | null;
  roleNameById: Map<string, string>;
  revokingId: string | null;
  onRevoke: (invite: CrmInvite) => void;
  onRequestDelete: (invite: CrmInvite) => void;
}

function PendingInvites({
  invites,
  loading,
  error,
  roleNameById,
  revokingId,
  onRevoke,
  onRequestDelete,
}: PendingInvitesProps): React.JSX.Element {
  return (
    <section className="st-invites">
      <div className="st-invites__head">
        <h2 className="st-invites__title">
          <span className="st-invites__title-icon" aria-hidden="true">
            <Mail size={15} />
          </span>
          Pending invitations
        </h2>
      </div>
      <p className="st-invites__desc">
        People invited to this workspace who haven&apos;t joined yet. Email
        delivery isn&apos;t wired up and the in-app acceptance flow is still
        coming — share each invite code below yourself in the meantime.
      </p>

      {loading ? (
        <RowsSkeleton count={2} />
      ) : error ? (
        <div className="st-banner">
          <AlertTriangle className="st-banner__icon" size={16} />
          <span>{error}</span>
        </div>
      ) : invites.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <MailX size={20} />
          </span>
          <h2 className="st-empty__title">No pending invitations</h2>
          <p className="st-empty__desc">
            Invite a member to add their invitation here.
          </p>
        </div>
      ) : (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>Invitee</th>
                <th>Role</th>
                <th>Status</th>
                <th>Invite code</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const code = inviteCodeFromToken(invite.token);
                const roleName = invite.roleId
                  ? roleNameById.get(invite.roleId) ?? 'Unknown role'
                  : 'Default access';
                return (
                  <tr key={invite.id} className="st-row">
                    <td>
                      <span className="st-invite-meta__email">{invite.email}</span>
                      <span className="st-invite-meta__time">
                        Invited {formatInvitedAt(invite.createdAt)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--st-text-secondary)' }}>{roleName}</td>
                    <td>
                      <span className="st-chip st-chip--pending">
                        <span className="st-chip__dot" aria-hidden="true" />
                        <span className="st-chip__label">Pending</span>
                      </span>
                    </td>
                    <td>
                      <div className="st-invite-link">
                        <span className="st-invite-link__label">
                          Share manually
                        </span>
                        <div className="st-invite-link__row">
                          <code className="st-invite-link__value" title={code}>
                            {code}
                          </code>
                          <CopyCodeButton value={code} />
                        </div>
                      </div>
                    </td>
                    <td className="st-cell-actions">
                      <TwentyButton
                        variant="ghost"
                        icon={MailX}
                        onClick={() => onRevoke(invite)}
                        disabled={revokingId === invite.id}
                        title="Revoke invitation"
                      >
                        {revokingId === invite.id ? 'Revoking…' : 'Revoke'}
                      </TwentyButton>
                      <TwentyButton
                        variant="ghost"
                        icon={Trash2}
                        className="st-btn--danger"
                        onClick={() => onRequestDelete(invite)}
                        title="Delete invitation"
                      >
                        Delete
                      </TwentyButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmMembersSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  // Roster
  const [members, setMembers] = React.useState<CrmMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Roles (for the invite role select + invite-row role labels)
  const [roles, setRoles] = React.useState<SabcrmRustRole[]>([]);
  const [rolesError, setRolesError] = React.useState(false);

  // Invitations
  const [invites, setInvites] = React.useState<CrmInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = React.useState(true);
  const [invitesError, setInvitesError] = React.useState<string | null>(null);

  // Dialog / row state
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmInvite | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Member role assignment — optimistic userId→roleId map, plus the userId
  // whose role is mid-flight (disables that row's select).
  const [memberRoleByUser, setMemberRoleByUser] = React.useState<
    Record<string, string>
  >({});
  const [roleUpdatingFor, setRoleUpdatingFor] = React.useState<string | null>(null);

  // Remove-member dialog target (graceful — no destructive backend action yet).
  const [removeTarget, setRemoveTarget] = React.useState<CrmMember | null>(null);

  // ----- Loaders -----

  const loadMembers = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMembersAction(projectId);
      if (res.ok) {
        setMembers(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Members could not be loaded. The service may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = React.useCallback(async (projectId: string) => {
    setRolesError(false);
    try {
      const res = await listRolesTw(projectId);
      if (res.ok) {
        setRoles(res.data);
        // Derive each member's current SabCRM role from the roles' memberIds.
        // First match wins; members absent from every role have no assignment.
        const map: Record<string, string> = {};
        for (const role of res.data) {
          for (const memberId of role.memberIds ?? []) {
            if (!map[memberId]) map[memberId] = role.id;
          }
        }
        setMemberRoleByUser(map);
      } else {
        setRolesError(true);
      }
    } catch {
      setRolesError(true);
    }
  }, []);

  const loadInvites = React.useCallback(async (projectId: string) => {
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const res = await listInvitesTw({ status: 'pending', projectId });
      if (res.ok) {
        setInvites(res.data as CrmInvite[]);
      } else {
        setInvitesError(res.error);
      }
    } catch {
      setInvitesError(
        'Invitations could not be loaded. The service may be unavailable.',
      );
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      setInvitesLoading(false);
      return;
    }
    void loadMembers(activeProjectId);
    void loadRoles(activeProjectId);
    void loadInvites(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadMembers, loadRoles, loadInvites]);

  // ----- Derived -----

  const adminCount = members.filter((m) => m.crmRole === 'admin').length;
  const managerCount = members.filter((m) => m.crmRole === 'manage').length;
  const viewerCount = members.filter((m) => m.crmRole === 'view').length;

  const roleNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roles) map.set(r.id, r.name);
    return map;
  }, [roles]);

  // ----- Invite mutations -----

  const handleCreated = React.useCallback((invite: CrmInvite) => {
    if (invite.status === 'pending') {
      setInvites((prev) => [invite, ...prev.filter((i) => i.id !== invite.id)]);
    }
  }, []);

  const handleRevoke = React.useCallback(
    async (invite: CrmInvite) => {
      if (!activeProjectId) return;
      setRevokingId(invite.id);
      setInvitesError(null);
      try {
        const res = await revokeInviteTw(invite.id, activeProjectId);
        if (res.ok) {
          // Revoked invites leave the pending list.
          setInvites((prev) => prev.filter((i) => i.id !== invite.id));
        } else {
          setInvitesError(res.error);
        }
      } catch {
        setInvitesError('Failed to revoke the invitation. The service may be unavailable.');
      } finally {
        setRevokingId(null);
      }
    },
    [activeProjectId],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    try {
      const res = await deleteInviteTw(deleteTarget.id, activeProjectId);
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setInvitesError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setInvitesError('Failed to delete the invitation. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId]);

  // ----- Member role assignment -----

  const handleRoleChange = React.useCallback(
    async (member: CrmMember, fromRoleId: string, toRoleId: string) => {
      if (!activeProjectId || fromRoleId === toRoleId) return;
      const userId = member.userId;
      setRoleUpdatingFor(userId);
      setError(null);
      // Optimistically reflect the new selection; revert on failure.
      setMemberRoleByUser((prev) => ({ ...prev, [userId]: toRoleId }));
      try {
        // Unassign from the previous role first (if any), then assign the new.
        if (fromRoleId) {
          const off = await setRoleMemberTw(fromRoleId, userId, false, activeProjectId);
          if (!off.ok) throw new Error(off.error);
        }
        if (toRoleId) {
          const on = await setRoleMemberTw(toRoleId, userId, true, activeProjectId);
          if (!on.ok) throw new Error(on.error);
        }
        // Resync roles so memberIds stay authoritative.
        await loadRoles(activeProjectId);
      } catch (e) {
        setMemberRoleByUser((prev) => ({ ...prev, [userId]: fromRoleId }));
        setError(
          e instanceof Error && e.message
            ? e.message
            : 'Failed to update the member role. The service may be unavailable.',
        );
      } finally {
        setRoleUpdatingFor(null);
      }
    },
    [activeProjectId, loadRoles],
  );

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Members"
          icon={Users}
          actions={
            activeProjectId ? (
              <TwentyButton
                variant="primary"
                icon={UserPlus}
                onClick={() => setInviteOpen(true)}
              >
                Invite member
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Workspace members and their SabCRM access level. Roles are managed
          centrally in the SabNode workspace settings (Settings → Team). Invite
          new people below — invitations surface a code to share until email
          delivery and the in-app acceptance flow are available.
        </p>

        {isLoadingProject || loading ? (
          <RowsSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to view its members.
            </p>
          </div>
        ) : error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : members.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <Users size={20} />
            </span>
            <h2 className="st-empty__title">No members found</h2>
            <p className="st-empty__desc">
              This workspace has no members, or member data could not be loaded.
            </p>
          </div>
        ) : (
          <>
            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Workspace role</th>
                    <th>SabCRM access</th>
                    <th>SabCRM role</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId} className="st-row">
                      <td>
                        <div className="st-identity">
                          <TwentyAvatar
                            name={member.name.trim() || member.email}
                            src={member.image}
                            size="sm"
                          />
                          <div className="st-identity__text">
                            <span className="st-identity__name">
                              {member.name.trim() || member.email}
                              {member.isOwner ? (
                                <span className="st-owner-tag">(owner)</span>
                              ) : null}
                            </span>
                            <span className="st-identity__sub">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          textTransform: 'capitalize',
                          color: 'var(--st-text-secondary)',
                        }}
                      >
                        {member.projectRole}
                      </td>
                      <td>
                        <CapabilityChip role={member.crmRole} />
                      </td>
                      <td>
                        <MemberRoleSelect
                          member={member}
                          roles={roles}
                          rolesError={rolesError}
                          currentRoleId={memberRoleByUser[member.userId] ?? ''}
                          busy={roleUpdatingFor === member.userId}
                          onChange={handleRoleChange}
                        />
                      </td>
                      <td className="st-cell-actions">
                        {member.isOwner ? null : (
                          <TwentyButton
                            variant="ghost"
                            icon={UserMinus}
                            className="st-btn--danger"
                            onClick={() => setRemoveTarget(member)}
                            title="Remove member"
                          >
                            Remove
                          </TwentyButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="st-footnote">
              {members.length} member{members.length !== 1 ? 's' : ''} — {adminCount}{' '}
              admin{adminCount !== 1 ? 's' : ''}, {managerCount} manager
              {managerCount !== 1 ? 's' : ''}, {viewerCount} viewer
              {viewerCount !== 1 ? 's' : ''}
            </p>
          </>
        )}

        {activeProjectId ? (
          <PendingInvites
            invites={invites}
            loading={invitesLoading}
            error={invitesError}
            roleNameById={roleNameById}
            revokingId={revokingId}
            onRevoke={handleRevoke}
            onRequestDelete={setDeleteTarget}
          />
        ) : null}
      </div>

      {inviteOpen && activeProjectId ? (
        <InviteDialog
          projectId={activeProjectId}
          roles={roles}
          rolesError={rolesError}
          onClose={() => setInviteOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteInviteDialog
          invite={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}

      {removeTarget ? (
        <RemoveMemberDialog
          member={removeTarget}
          onCancel={() => setRemoveTarget(null)}
        />
      ) : null}
    </div>
  );
}
