'use client';

/**
 * SabCRM - Members settings (`/dashboard/settings/crm/members`).
 *
 * Two stacked surfaces, both scoped to the active project via `useProject()`:
 *
 *   1. Members roster - list of the workspace's members, each row showing
 *      avatar, name + email, workspace role, the derived SabCRM capability
 *      chip, and an inline SabCRM-role select. Data comes from
 *      `listMembersAction`; the per-member role is derived from each role's
 *      `memberIds` (via `listRolesTw`) and changed with `setRoleMemberTw`
 *      (unassign-then-assign). Owners are pinned to full access and excluded
 *      from reassignment. Each non-owner row also exposes a Remove action;
 *      because there is no SabCRM member-removal server action, that opens a
 *      dialog explaining removal is a SabNode workspace operation
 *      (Settings, Team) - the page degrades gracefully rather than calling a
 *      missing backend.
 *
 *   2. Pending invitations - the member INVITATION flow. An "Invite member"
 *      button opens a dialog (email + role select) that calls `createInviteTw`.
 *      The section below the roster lists pending invites
 *      (`listInvitesTw({ status: 'pending' })`) with email, role, status chip,
 *      invited-at, and Revoke / Delete actions. Because there is no email
 *      delivery yet - and no consuming acceptance route for the token - each
 *      invite surfaces its token as a copyable invite CODE (not a URL),
 *      clearly labelled as such; the in-app acceptance flow is still coming.
 *
 * Every action independently re-runs the session, project, RBAC, plan pipeline
 * server-side, so the page fails closed. States: skeleton while the project /
 * data load, "no project" notice, empty roster, error banner, and graceful
 * degradation when the engine is unreachable.
 *
 * UI: pure 20ui (`@/components/sabcrm/20ui`).
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
  MailX,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Field,
  Input,
  Alert,
  Callout,
  EmptyState,
  Skeleton,
  Modal,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

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

// No specific role option uses an empty string under the hood; Radix Select does
// not accept empty-string item values, so the "no role" choice carries this id.
const NO_ROLE_VALUE = '__none__';

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
 * There is no `/sabcrm/invite/<token>` route - SabCRM invite tokens have no
 * consuming acceptance route yet - so this deliberately surfaces the token
 * itself as a copyable code rather than fabricating a dead URL.
 */
function inviteCodeFromToken(token: string): string {
  return token;
}

// ---------------------------------------------------------------------------
// Capability chip - a Badge with the capability icon.
// ---------------------------------------------------------------------------

function CapabilityChip({ role }: { role: CrmMemberRole }): React.JSX.Element {
  const cap = CAPABILITY_INFO[role];
  const { Icon } = cap;
  return (
    <Badge tone="neutral" className="gap-1">
      <Icon size={12} aria-hidden="true" />
      {cap.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Copyable value - shared by the dialog success state and each invite row.
// Copies the invite CODE (the token), not a URL.
// ---------------------------------------------------------------------------

function CopyCodeButton({ value }: { value: string }): React.JSX.Element {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Invite code copied');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy. Clipboard is unavailable.');
    }
  }, [value, toast]);
  return (
    <Button
      variant="secondary"
      size="sm"
      iconLeft={copied ? Check : Copy}
      onClick={copy}
      title="Copy invite code"
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Invite dialog - email + role select -> createInviteTw
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
  const [roleId, setRoleId] = React.useState<string>(NO_ROLE_VALUE);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The created invite, surfaced once on success.
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
        const resolvedRole = roleId === NO_ROLE_VALUE ? undefined : roleId;
        const res = await createInviteTw(trimmed, resolvedRole, projectId);
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

  if (created) {
    const code = inviteCodeFromToken(created.token);
    return (
      <Modal
        open
        onClose={onClose}
        title="Invitation created"
        size="sm"
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={`Invite code for ${created.email}`}>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5 font-mono text-[13px] text-[var(--st-text)]">
                {code}
              </code>
              <CopyCodeButton value={code} />
            </div>
          </Field>
          <p className="m-0 text-[13px] text-[var(--st-text-secondary)]">
            Email delivery is not wired up yet, and the in-app acceptance flow is
            still coming. For now, copy this invite code and share it with{' '}
            {created.email} yourself. Once the acceptance flow ships, they will be
            able to redeem the code to join the workspace.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite member"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-member-form"
            variant="primary"
            loading={submitting}
          >
            {submitting ? 'Creating' : 'Create invitation'}
          </Button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email address" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            autoFocus
          />
        </Field>

        <Field
          label="Role"
          error={
            rolesError
              ? 'Roles could not be loaded. The invite will use default access.'
              : undefined
          }
        >
          <Select value={roleId} onValueChange={setRoleId} disabled={rolesError}>
            <SelectTrigger aria-label="Invite role">
              <SelectValue placeholder="No specific role (default access)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROLE_VALUE}>
                No specific role (default access)
              </SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Callout tone="info">
          Email delivery is not wired up yet and the in-app acceptance flow is
          still coming. After creating the invitation you will get an invite code
          to share with the person yourself.
        </Callout>

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Modal>
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
    <Modal
      open
      onClose={onCancel}
      title="Delete invitation"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {busy ? 'Deleting' : 'Delete invitation'}
          </Button>
        </>
      }
    >
      <p className="m-0 text-[var(--st-text-secondary)]">
        Delete the invitation for{' '}
        <strong className="text-[var(--st-text)]">{invite.email}</strong>? The
        invite code will stop working and the record is removed. This cannot be
        undone.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Member role select - inline per-member SabCRM role assignment.
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
  // Owners always retain full access - their role is not reassignable here.
  if (member.isOwner) {
    return <span className="text-[var(--st-text-tertiary)]">Owner (full access)</span>;
  }
  if (rolesError || roles.length === 0) {
    const name = currentRoleId
      ? roles.find((r) => r.id === currentRoleId)?.name ?? 'Custom role'
      : 'No role assigned';
    return <span className="text-[var(--st-text-secondary)]">{name}</span>;
  }
  const value = currentRoleId || NO_ROLE_VALUE;
  return (
    <Select
      value={value}
      disabled={busy}
      onValueChange={(next) =>
        onChange(member, currentRoleId, next === NO_ROLE_VALUE ? '' : next)
      }
    >
      <SelectTrigger
        className="max-w-[200px]"
        aria-label={`SabCRM role for ${member.name.trim() || member.email}`}
      >
        <SelectValue placeholder="No role assigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ROLE_VALUE}>No role assigned</SelectItem>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Remove-member confirmation
//
// There is no SabCRM member-removal server action yet, so this dialog degrades
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
    <Modal
      open
      onClose={onCancel}
      title="Remove member from workspace"
      size="sm"
      footer={
        <Button variant="primary" onClick={onCancel}>
          Got it
        </Button>
      }
    >
      <p className="m-0 text-[var(--st-text-secondary)]">
        Removing{' '}
        <strong className="text-[var(--st-text)]">
          {member.name.trim() || member.email}
        </strong>{' '}
        from the workspace is managed centrally in SabNode workspace settings
        (Settings, Team), alongside billing and access. Open Team settings there
        to remove this person; their SabCRM access is revoked automatically once
        they leave the workspace.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function RowsSkeleton({ count = 4 }: { count?: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={44} radius={8} />
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
    <Card padding="none" className="mt-6 overflow-hidden">
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>
          People invited to this workspace who have not joined yet. Email
          delivery is not wired up and the in-app acceptance flow is still
          coming. Share each invite code below yourself in the meantime.
        </CardDescription>
      </CardHeader>

      {loading ? (
        <CardBody>
          <RowsSkeleton count={2} />
        </CardBody>
      ) : error ? (
        <CardBody>
          <Alert tone="danger">{error}</Alert>
        </CardBody>
      ) : invites.length === 0 ? (
        <CardBody>
          <EmptyState
            icon={MailX}
            title="No pending invitations"
            description="Invite a member to add their invitation here."
          />
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full">
            <THead>
              <Tr>
                <Th>Invitee</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Invite code</Th>
                <Th align="right" aria-label="Actions">
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {invites.map((invite) => {
                const code = inviteCodeFromToken(invite.token);
                const roleName = invite.roleId
                  ? roleNameById.get(invite.roleId) ?? 'Unknown role'
                  : 'Default access';
                return (
                  <Tr key={invite.id}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-[var(--st-text)]">{invite.email}</span>
                        <span className="text-xs text-[var(--st-text-tertiary)]">
                          Invited {formatInvitedAt(invite.createdAt)}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{roleName}</Td>
                    <Td>
                      <Badge tone="warning" dot>
                        Pending
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--st-text-tertiary)]">
                          Share manually
                        </span>
                        <div className="flex items-center gap-2">
                          <code
                            className="max-w-[160px] truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1 font-mono text-xs text-[var(--st-text)]"
                            title={code}
                          >
                            {code}
                          </code>
                          <CopyCodeButton value={code} />
                        </div>
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={MailX}
                          onClick={() => onRevoke(invite)}
                          disabled={revokingId === invite.id}
                          title="Revoke invitation"
                        >
                          {revokingId === invite.id ? 'Revoking' : 'Revoke'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          iconLeft={Trash2}
                          onClick={() => onRequestDelete(invite)}
                          title="Delete invitation"
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmMembersSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

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

  // Member role assignment - optimistic userId->roleId map, plus the userId
  // whose role is mid-flight (disables that row's select).
  const [memberRoleByUser, setMemberRoleByUser] = React.useState<
    Record<string, string>
  >({});
  const [roleUpdatingFor, setRoleUpdatingFor] = React.useState<string | null>(null);

  // Remove-member dialog target (graceful - no destructive backend action yet).
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
          toast.success('Invitation revoked');
        } else {
          setInvitesError(res.error);
        }
      } catch {
        setInvitesError('Failed to revoke the invitation. The service may be unavailable.');
      } finally {
        setRevokingId(null);
      }
    },
    [activeProjectId, toast],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    try {
      const res = await deleteInviteTw(deleteTarget.id, activeProjectId);
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        setDeleteTarget(null);
        toast.success('Invitation deleted');
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
  }, [deleteTarget, activeProjectId, toast]);

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
        toast.success('Member role updated');
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
    [activeProjectId, loadRoles, toast],
  );

  return (
    <div className="ui20 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Members</PageTitle>
          <PageDescription>
            Workspace members and their SabCRM access level. Roles are managed
            centrally in the SabNode workspace settings (Settings, Team). Invite
            new people below. Invitations surface a code to share until email
            delivery and the in-app acceptance flow are available.
          </PageDescription>
        </PageHeaderHeading>
        {activeProjectId ? (
          <PageActions>
            <Button
              variant="primary"
              iconLeft={UserPlus}
              onClick={() => setInviteOpen(true)}
            >
              Invite member
            </Button>
          </PageActions>
        ) : null}
      </PageHeader>

      <div className="mt-6">
        {isLoadingProject || loading ? (
          <RowsSkeleton />
        ) : !activeProjectId ? (
          <EmptyState
            icon={AlertTriangle}
            tone="warning"
            title="No project selected"
            description="Select a project to view its members."
          />
        ) : error ? (
          <Alert tone="danger" title="Could not load members">
            {error}
          </Alert>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members found"
            description="This workspace has no members, or member data could not be loaded."
          />
        ) : (
          <>
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <THead>
                    <Tr>
                      <Th>Member</Th>
                      <Th>Workspace role</Th>
                      <Th>SabCRM access</Th>
                      <Th>SabCRM role</Th>
                      <Th align="right" aria-label="Actions">
                        <span className="sr-only">Actions</span>
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {members.map((member) => (
                      <Tr key={member.userId}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={member.name.trim() || member.email}
                              src={member.image}
                              size="sm"
                            />
                            <div className="flex flex-col">
                              <span className="flex items-center gap-1.5 text-[var(--st-text)]">
                                {member.name.trim() || member.email}
                                {member.isOwner ? (
                                  <span className="text-xs text-[var(--st-text-tertiary)]">
                                    (owner)
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-xs text-[var(--st-text-tertiary)]">
                                {member.email}
                              </span>
                            </div>
                          </div>
                        </Td>
                        <Td className="capitalize text-[var(--st-text-secondary)]">
                          {member.projectRole}
                        </Td>
                        <Td>
                          <CapabilityChip role={member.crmRole} />
                        </Td>
                        <Td>
                          <MemberRoleSelect
                            member={member}
                            roles={roles}
                            rolesError={rolesError}
                            currentRoleId={memberRoleByUser[member.userId] ?? ''}
                            busy={roleUpdatingFor === member.userId}
                            onChange={handleRoleChange}
                          />
                        </Td>
                        <Td align="right">
                          {member.isOwner ? null : (
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={UserMinus}
                                onClick={() => setRemoveTarget(member)}
                                title="Remove member"
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
            <p className="mt-3 text-sm text-[var(--st-text-tertiary)]">
              {members.length} member{members.length !== 1 ? 's' : ''}, {adminCount}{' '}
              admin{adminCount !== 1 ? 's' : ''}, {managerCount} manager
              {managerCount !== 1 ? 's' : ''}, {viewerCount} viewer
              {viewerCount !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>

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
