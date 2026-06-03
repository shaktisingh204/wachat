'use client';

/**
 * SabCRM — Roles & Permissions settings (`/sabcrm/settings/roles`),
 * Twenty-faithful.
 *
 * A two-pane "Roles" screen in Twenty's Settings visual language:
 *   - LEFT pane lists every role for the active project (name, member count,
 *     default badge) with a "New role" action.
 *   - RIGHT pane is the editor for the selected role:
 *       · editable name + description (saved via `updateRoleTw`),
 *       · a permission matrix — Twenty toggle rows for each capability key,
 *         persisted with `updateRoleTw({ permissions })`,
 *       · a member roster (from `listMembersAction`) where each row toggles
 *         assignment to this role via `setRoleMemberTw`, with assigned members
 *         surfaced as TwentyAvatar chips,
 *       · delete (confirm) for non-default roles.
 *
 * Every mutation goes through the gated server actions in
 * `@/app/actions/sabcrm-roles.actions` (session → project → RBAC → plan), which
 * wrap the roles engine. That engine may be DOWN; each call returns an
 * `ActionResult`, so the page degrades to loading / empty / error states and
 * never crashes. Auth / RBAC / project context are enforced by the parent
 * `../../layout.tsx`; the actions independently re-run the full gate.
 *
 * Twenty look only (`.st-*` kit + the sibling `./roles.css`). No ZoruUI /
 * Tailwind / clay.
 */

import * as React from 'react';
import {
  Plus,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Trash2,
  Check,
  X,
  Eye,
  Pencil,
  Settings,
  Users,
  Database,
} from 'lucide-react';

import {
  TwentyPageHeader,
  TwentyButton,
  TwentyAvatar,
} from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import {
  listRolesTw,
  createRoleTw,
  updateRoleTw,
  deleteRoleTw,
  setRoleMemberTw,
} from '@/app/actions/sabcrm-roles.actions';
import type { CrmMember } from '@/lib/sabcrm/members.server';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './roles.css';

// ---------------------------------------------------------------------------
// Role shape (mirrors the `sabcrm-roles.actions` payload).
// ---------------------------------------------------------------------------

interface CrmRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  memberIds: string[];
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Permission catalogue — the fixed set of capability keys a role can grant.
// ---------------------------------------------------------------------------

interface PermissionInfo {
  key: string;
  label: string;
  desc: string;
  Icon: React.ElementType;
}

const PERMISSIONS: ReadonlyArray<PermissionInfo> = [
  {
    key: 'records:read',
    label: 'View records',
    desc: 'Read records across the CRM objects.',
    Icon: Eye,
  },
  {
    key: 'records:write',
    label: 'Create & edit records',
    desc: 'Add new records and modify existing ones.',
    Icon: Pencil,
  },
  {
    key: 'records:delete',
    label: 'Delete records',
    desc: 'Permanently remove records.',
    Icon: Trash2,
  },
  {
    key: 'settings:manage',
    label: 'Manage settings',
    desc: 'Edit the data model, views, automations and integrations.',
    Icon: Settings,
  },
  {
    key: 'members:manage',
    label: 'Manage members',
    desc: 'Invite, assign roles to, and remove workspace members.',
    Icon: Users,
  },
];

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

/** Inline saving / saved / error status shown beside a block head. */
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveStatus({ state }: { state: SaveState }): React.JSX.Element | null {
  if (state === 'saving') {
    return (
      <span className="rp-status rp-status--saving">
        <Loader2 size={13} className="st-spin" aria-hidden="true" /> Saving…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="rp-status rp-status--saved">
        <Check size={13} aria-hidden="true" /> Saved
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="rp-status rp-status--error">
        <AlertTriangle size={13} aria-hidden="true" /> Not saved
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Left pane — role list
// ---------------------------------------------------------------------------

interface RoleListProps {
  roles: CrmRole[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  creating: boolean;
}

function RoleList({
  roles,
  activeId,
  onSelect,
  onNew,
  creating,
}: RoleListProps): React.JSX.Element {
  return (
    <nav className="rp-list" aria-label="Roles">
      <div className="rp-list__head">
        <h2 className="rp-list__heading">Roles</h2>
        <TwentyButton
          variant="secondary"
          icon={Plus}
          onClick={onNew}
          disabled={creating}
        >
          New role
        </TwentyButton>
      </div>
      <div className="rp-list__body">
        {roles.length === 0 ? (
          <p className="rp-list__empty">No roles yet.</p>
        ) : (
          roles.map((role) => {
            const active = role.id === activeId;
            const count = role.memberIds.length;
            return (
              <button
                key={role.id}
                type="button"
                className={`rp-item${active ? ' active' : ''}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(role.id)}
              >
                <span className="rp-item__icon" aria-hidden="true">
                  {role.isDefault ? (
                    <ShieldCheck size={15} />
                  ) : (
                    <Shield size={15} />
                  )}
                </span>
                <span className="rp-item__body">
                  <span className="rp-item__name">
                    {role.name}
                    {role.isDefault ? (
                      <span className="rp-badge rp-badge--default">Default</span>
                    ) : null}
                  </span>
                  <span className="rp-item__meta">
                    {count} member{count !== 1 ? 's' : ''}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Right pane — role editor: name + description block
// ---------------------------------------------------------------------------

interface IdentityBlockProps {
  role: CrmRole;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function IdentityBlock({
  role,
  projectId,
  onSaved,
}: IdentityBlockProps): React.JSX.Element {
  const [name, setName] = React.useState(role.name);
  const [description, setDescription] = React.useState(role.description ?? '');
  const [state, setState] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync the form when the selected role changes underneath us.
  React.useEffect(() => {
    setName(role.name);
    setDescription(role.description ?? '');
    setState('idle');
    setError(null);
  }, [role.id, role.name, role.description]);

  const dirty =
    name.trim() !== role.name || description.trim() !== (role.description ?? '');
  const canSave = dirty && name.trim().length > 0 && state !== 'saving';

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setState('saving');
    setError(null);
    const res = await updateRoleTw(
      role.id,
      { name: name.trim(), description: description.trim() || undefined },
      projectId ?? undefined,
    );
    if (res.ok) {
      setState('saved');
      onSaved(res.data);
    } else {
      setState('error');
      setError(res.error);
    }
  };

  return (
    <section className="rp-block" aria-label="Role details">
      <div className="rp-block__head">
        <div>
          <h3 className="rp-block__title">Details</h3>
          <p className="rp-block__sub">The role&apos;s name and description.</p>
        </div>
        <SaveStatus state={state} />
      </div>
      <div className="rp-block__body">
        <div className="st-field">
          <span className="st-field__label">
            Name<span className="st-field__req">*</span>
          </span>
          <input
            className="st-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setState('idle');
            }}
            placeholder="Sales rep"
            autoComplete="off"
            disabled={role.isDefault}
          />
        </div>
        <div className="st-field">
          <span className="st-field__label">Description</span>
          <textarea
            className="st-textarea"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setState('idle');
            }}
            placeholder="What this role is allowed to do."
            rows={2}
          />
        </div>
        {error ? <p className="st-form-error">{error}</p> : null}
        <div>
          <button
            type="button"
            className="st-btn st-btn--primary"
            disabled={!canSave}
            onClick={handleSave}
          >
            {state === 'saving' ? (
              <Loader2 size={14} className="st-spin" aria-hidden="true" />
            ) : null}
            Save changes
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Right pane — permission matrix
// ---------------------------------------------------------------------------

interface PermissionBlockProps {
  role: CrmRole;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function PermissionBlock({
  role,
  projectId,
  onSaved,
}: PermissionBlockProps): React.JSX.Element {
  const [state, setState] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const granted = React.useMemo(
    () => new Set(role.permissions),
    [role.permissions],
  );

  const handleToggle = async (key: string, next: boolean): Promise<void> => {
    if (role.isDefault) return;
    const nextPerms = new Set(role.permissions);
    if (next) nextPerms.add(key);
    else nextPerms.delete(key);

    setBusyKey(key);
    setState('saving');
    setError(null);
    const res = await updateRoleTw(
      role.id,
      { permissions: Array.from(nextPerms) },
      projectId ?? undefined,
    );
    setBusyKey(null);
    if (res.ok) {
      setState('saved');
      onSaved(res.data);
    } else {
      setState('error');
      setError(res.error);
    }
  };

  return (
    <section className="rp-block" aria-label="Permissions">
      <div className="rp-block__head">
        <div>
          <h3 className="rp-block__title">Permissions</h3>
          <p className="rp-block__sub">
            Capabilities granted to everyone with this role.
          </p>
        </div>
        <SaveStatus state={state} />
      </div>
      <div className="rp-block__body">
        {role.isDefault ? (
          <p className="rp-block__sub">
            The default role&apos;s permissions are managed by the system and
            cannot be edited.
          </p>
        ) : null}
        <div className="rp-matrix" role="group" aria-label="Permission matrix">
          {PERMISSIONS.map((perm) => {
            const { Icon } = perm;
            const checked = granted.has(perm.key);
            const busy = busyKey === perm.key;
            const disabled = role.isDefault || busy;
            return (
              <label
                key={perm.key}
                className={`rp-perm${disabled ? ' rp-perm--disabled' : ''}`}
              >
                <span className="rp-perm__icon" aria-hidden="true">
                  <Icon size={15} />
                </span>
                <span className="rp-perm__body">
                  <span className="rp-perm__label">{perm.label}</span>
                  <span className="rp-perm__key">{perm.key}</span>
                </span>
                {busy ? (
                  <Loader2
                    size={14}
                    className="st-spin"
                    style={{ color: 'var(--st-text-tertiary)' }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="rp-switch">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => handleToggle(perm.key, e.target.checked)}
                    aria-label={perm.label}
                  />
                  <span className="rp-switch__track" aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
        {error ? <p className="st-form-error">{error}</p> : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Right pane — member assignment
// ---------------------------------------------------------------------------

interface MemberBlockProps {
  role: CrmRole;
  members: CrmMember[];
  membersLoading: boolean;
  membersError: string | null;
  projectId: string | null;
  onSaved: (next: CrmRole) => void;
}

function MemberBlock({
  role,
  members,
  membersLoading,
  membersError,
  projectId,
  onSaved,
}: MemberBlockProps): React.JSX.Element {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const assigned = React.useMemo(
    () => new Set(role.memberIds),
    [role.memberIds],
  );

  const assignedMembers = React.useMemo(
    () => members.filter((m) => assigned.has(m.userId)),
    [members, assigned],
  );

  const handleToggle = async (
    member: CrmMember,
    next: boolean,
  ): Promise<void> => {
    setBusyId(member.userId);
    setError(null);
    const res = await setRoleMemberTw(
      role.id,
      member.userId,
      next,
      projectId ?? undefined,
    );
    setBusyId(null);
    if (res.ok) {
      onSaved(res.data);
    } else {
      setError(res.error);
    }
  };

  return (
    <section className="rp-block" aria-label="Members">
      <div className="rp-block__head">
        <div>
          <h3 className="rp-block__title">Members</h3>
          <p className="rp-block__sub">
            {assigned.size} member{assigned.size !== 1 ? 's' : ''} assigned to
            this role.
          </p>
        </div>
      </div>
      <div className="rp-block__body">
        {/* Assigned-member chips. */}
        <div className="rp-assigned">
          {assignedMembers.length === 0 ? (
            <span className="rp-assigned__empty">No members assigned yet.</span>
          ) : (
            assignedMembers.map((m) => (
              <span key={m.userId} className="rp-assigned__chip">
                <TwentyAvatar
                  name={m.name.trim() || m.email}
                  src={m.image}
                  size="sm"
                />
                {m.name.trim() || m.email}
              </span>
            ))
          )}
        </div>

        {/* Roster: assign / unassign. */}
        {membersLoading ? (
          <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="st-skeleton st-skeleton-row" />
            ))}
          </div>
        ) : membersError ? (
          <ErrorBanner message={membersError} />
        ) : members.length === 0 ? (
          <p className="rp-block__sub">No workspace members found.</p>
        ) : (
          <div className="rp-roster" role="group" aria-label="Assign members">
            {members.map((m) => {
              const isAssigned = assigned.has(m.userId);
              const busy = busyId === m.userId;
              const name = m.name.trim() || m.email;
              return (
                <label
                  key={m.userId}
                  className={`rp-member${busy ? ' rp-member--busy' : ''}`}
                >
                  <span className="rp-member__check">
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={busy}
                      onChange={(e) => handleToggle(m, e.target.checked)}
                      aria-label={`Assign ${name} to ${role.name}`}
                    />
                  </span>
                  <TwentyAvatar name={name} src={m.image} size="sm" />
                  <span className="rp-member__body">
                    <span className="rp-member__name">
                      {name}
                      {m.isOwner ? (
                        <span className="st-owner-tag">(owner)</span>
                      ) : null}
                    </span>
                    <span className="rp-member__email">{m.email}</span>
                  </span>
                  {busy ? (
                    <Loader2
                      size={14}
                      className="st-spin rp-member__spin"
                      aria-hidden="true"
                    />
                  ) : null}
                </label>
              );
            })}
          </div>
        )}
        {error ? <p className="st-form-error">{error}</p> : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Delete-role confirm dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  role: CrmRole;
  projectId: string | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteDialog({
  role,
  projectId,
  onClose,
  onDeleted,
}: DeleteDialogProps): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const res = await deleteRoleTw(role.id, projectId ?? undefined);
    setBusy(false);
    if (res.ok) {
      onDeleted(role.id);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="st-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${role.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete role</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete <strong style={{ color: 'var(--st-text)' }}>{role.name}</strong>?
            Its {role.memberIds.length} member
            {role.memberIds.length !== 1 ? 's' : ''} will lose the permissions
            this role grants. This cannot be undone.
          </p>
          {error ? <ErrorBanner message={error} /> : null}
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </TwentyButton>
          <button
            type="button"
            className="st-btn st-btn--danger"
            onClick={handleDelete}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={14} className="st-spin" aria-hidden="true" />
            ) : (
              <Trash2 size={14} aria-hidden="true" />
            )}
            Delete role
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RolesPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [roles, setRoles] = React.useState<CrmRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const [members, setMembers] = React.useState<CrmMember[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(true);
  const [membersError, setMembersError] = React.useState<string | null>(null);

  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // ---- Load roles ---------------------------------------------------------
  React.useEffect(() => {
    if (isLoadingProject) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await listRolesTw(activeProjectId ?? undefined);
        if (cancelled) return;
        if (res.ok) {
          setRoles(res.data);
          setActiveId((prev) => {
            if (prev && res.data.some((r) => r.id === prev)) return prev;
            return res.data.length > 0 ? res.data[0]!.id : null;
          });
        } else {
          setError(res.error);
          setRoles([]);
        }
      } catch {
        if (!cancelled) {
          setError('Roles could not be loaded. The service may be unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject]);

  // ---- Load members (for the roster) -------------------------------------
  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    (async () => {
      try {
        const res = await listMembersAction(activeProjectId);
        if (cancelled) return;
        if (res.ok) setMembers(res.data);
        else setMembersError(res.error);
      } catch {
        if (!cancelled) {
          setMembersError('Members could not be loaded.');
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, isLoadingProject]);

  /** Replace one role in the list with its updated payload. */
  const upsertRole = React.useCallback((next: CrmRole) => {
    setRoles((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  const activeRole = React.useMemo(
    () => roles.find((r) => r.id === activeId) ?? null,
    [roles, activeId],
  );

  const handleNewRole = React.useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    const res = await createRoleTw(
      { name: 'New role', description: '', permissions: [] },
      activeProjectId ?? undefined,
    );
    setCreating(false);
    if (res.ok) {
      setRoles((prev) => [...prev, res.data]);
      setActiveId(res.data.id);
    } else {
      setCreateError(res.error);
    }
  }, [activeProjectId]);

  const handleDeleted = React.useCallback(
    (id: string) => {
      setDeleteOpen(false);
      setRoles((prev) => {
        const next = prev.filter((r) => r.id !== id);
        setActiveId((cur) =>
          cur === id ? (next.length > 0 ? next[0]!.id : null) : cur,
        );
        return next;
      });
    },
    [],
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div className="st-page">
      <TwentyPageHeader title="Roles & Permissions" icon={Shield} />
      <p className="st-settings__intro">
        Define roles, the permissions they grant, and which workspace members
        belong to each. Roles are scoped to the active project.
      </p>

      {isLoadingProject || loading ? (
        <div className="rp-layout">
          <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="st-skeleton st-skeleton-row" />
            ))}
          </div>
          <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="st-skeleton st-skeleton-row" />
            ))}
          </div>
        </div>
      ) : !activeProjectId ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <AlertTriangle size={20} />
          </span>
          <h2 className="st-empty__title">No project selected</h2>
          <p className="st-empty__desc">
            Select a project to manage its roles and permissions.
          </p>
        </div>
      ) : error ? (
        <ErrorBanner message={error} />
      ) : roles.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">No roles yet</h2>
          <p className="st-empty__desc">
            Create your first role to grant scoped permissions to members.
          </p>
          <TwentyButton
            variant="primary"
            icon={Plus}
            onClick={handleNewRole}
            disabled={creating}
          >
            New role
          </TwentyButton>
        </div>
      ) : (
        <>
          {createError ? <ErrorBanner message={createError} /> : null}
          <div className="rp-layout">
            <RoleList
              roles={roles}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setCreateError(null);
              }}
              onNew={handleNewRole}
              creating={creating}
            />

            {activeRole ? (
              <div className="rp-detail">
                <div className="rp-detail__head">
                  <h2 className="rp-detail__title">
                    {activeRole.isDefault ? (
                      <ShieldCheck size={18} aria-hidden="true" />
                    ) : (
                      <Shield size={18} aria-hidden="true" />
                    )}
                    {activeRole.name}
                    {activeRole.isDefault ? (
                      <span className="rp-badge rp-badge--default">Default</span>
                    ) : null}
                  </h2>
                  {!activeRole.isDefault ? (
                    <div className="rp-detail__actions">
                      <button
                        type="button"
                        className="st-btn st-btn--ghost st-btn--danger"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                <IdentityBlock
                  key={`id-${activeRole.id}`}
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
                <PermissionBlock
                  role={activeRole}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
                <MemberBlock
                  role={activeRole}
                  members={members}
                  membersLoading={membersLoading}
                  membersError={membersError}
                  projectId={activeProjectId}
                  onSaved={upsertRole}
                />
              </div>
            ) : (
              <div className="rp-detail__placeholder">
                Select a role to edit its permissions and members.
              </div>
            )}
          </div>
        </>
      )}

      {deleteOpen && activeRole && !activeRole.isDefault ? (
        <DeleteDialog
          role={activeRole}
          projectId={activeProjectId}
          onClose={() => setDeleteOpen(false)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
