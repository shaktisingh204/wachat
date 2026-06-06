'use client';

/**
 * Full SabFlow workspace settings page.
 *
 * Tabs: General / Members / Invites / Billing
 *
 * The component is self-contained: it does its own fetching to all the
 * `/api/sabflow/workspaces/*` endpoints. The parent just needs to pass
 * the workspaceId and the initial workspace (from the server page).
 */

import { Skeleton } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LuBuilding,
  LuCreditCard,
  LuCrown,
  LuMail,
  LuShieldCheck,
  LuTrash2,
  LuUserPlus,
  LuUsers,
  LuHistory,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type {
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from '@/lib/sabflow/workspaces/types';
import {
  canManageMembers,
  canManageWorkspace,
} from '@/lib/sabflow/workspaces/permissions';

/* ── Types ────────────────────────────────────────────────── */

type Tab = 'general' | 'members' | 'invites' | 'billing' | 'audit';

interface Props {
  workspaceId: string;
  initialWorkspace: Workspace;
  /** Role of the currently-logged-in viewer, for permission-aware UI. */
  currentUserRole: WorkspaceRole;
  /** Currently logged-in user id — used to prevent self-role-demotion. */
  currentUserId: string;
}

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== 'owner');

/* ── Root component ───────────────────────────────────────── */

export function WorkspaceSettingsPage({
  workspaceId,
  initialWorkspace,
  currentUserRole,
  currentUserId,
}: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
    useMemo(
      () => [
        { id: 'general', label: 'General', icon: LuBuilding },
        { id: 'members', label: 'Members', icon: LuUsers },
        { id: 'invites', label: 'Invites', icon: LuMail },
        { id: 'audit', label: 'Audit Log', icon: LuHistory },
        { id: 'billing', label: 'Billing', icon: LuCreditCard },
      ],
      [],
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-white">
          {workspace.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={workspace.iconUrl}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <LuBuilding className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--st-text)] dark:text-white">
            {workspace.name}
          </h1>
          <p className="text-[13px] text-[var(--st-text)]">Workspace settings</p>
        </div>
      </header>

      <nav
        role="tablist"
        aria-label="Workspace settings"
        className="flex gap-1 border-b border-[var(--st-border)] dark:border-[var(--st-border)]"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              aria-controls={`tab-panel-${id}`}
              id={`tab-${id}`}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-t-md px-4 py-2.5 text-[13px] font-medium transition-colors',
                active
                  ? 'border-b-2 border-[var(--color-primary,#f76808)] text-[var(--st-text)] dark:text-white'
                  : 'text-[var(--st-text)] hover:text-[var(--st-text)] dark:hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div
        role="tabpanel"
        id={`tab-panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'general' && (
          <GeneralTab
            workspace={workspace}
            canEdit={canManageWorkspace(currentUserRole)}
            onUpdated={setWorkspace}
          />
        )}
        {tab === 'members' && (
          <MembersTab
            workspaceId={workspaceId}
            canManage={canManageMembers(currentUserRole)}
            isOwner={currentUserRole === 'owner'}
            currentUserId={currentUserId}
          />
        )}
        { tab === 'invites' && (
          <InvitesTab
            workspaceId={workspaceId}
            canManage={canManageMembers(currentUserRole)}
          />
        )}
        {tab === 'audit' && (
          <AuditTab
            workspaceId={workspaceId}
            canManage={canManageWorkspace(currentUserRole)}
          />
        )}
        {tab === 'billing' && <BillingTab workspace={workspace} />}
      </div>
    </div>
  );
}

export default WorkspaceSettingsPage;

/* ══════════════════════════════════════════════════════════
   General tab
   ══════════════════════════════════════════════════════════ */

function GeneralTab({
  workspace,
  canEdit,
  onUpdated,
}: {
  workspace: Workspace;
  canEdit: boolean;
  onUpdated: (ws: Workspace) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [iconUrl, setIconUrl] = useState(workspace.iconUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const dirty =
    name !== workspace.name ||
    slug !== workspace.slug ||
    iconUrl !== (workspace.iconUrl ?? '');

  const handleSave = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      setOk(null);
      try {
        const res = await fetch(`/api/sabflow/workspaces/${workspace.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, iconUrl: iconUrl || undefined }),
        });
        const data = (await res.json()) as { workspace?: Workspace; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to save');
        }
        if (data.workspace) onUpdated(data.workspace);
        setOk('Saved');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(false);
      }
    },
    [iconUrl, name, onUpdated, slug, workspace.id],
  );

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/sabflow/workspaces/${workspace.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to delete');
      }
      router.push('/dashboard/sabflow');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  }, [router, workspace.id, workspace.name]);

  return (
    <form className="flex flex-col gap-6 py-2" onSubmit={handleSave}>
      <Panel title="Workspace details">
        <Field label="Name" htmlFor="ws-name">
          <input
            id="ws-name"
            type="text"
            value={name}
            disabled={!canEdit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            className="w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 text-sm text-[var(--st-text)] focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-[var(--st-border)] dark:bg-[var(--st-text)] dark:text-white"
          />
        </Field>
        <Field
          label="Slug"
          hint="Lowercase letters, numbers and dashes."
          htmlFor="ws-slug"
        >
          <input
            id="ws-slug"
            type="text"
            value={slug}
            disabled={!canEdit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
            className="w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 font-mono text-sm text-[var(--st-text)] focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-[var(--st-border)] dark:bg-[var(--st-text)] dark:text-white"
          />
        </Field>
        <Field label="Icon URL" htmlFor="ws-icon">
          <input
            id="ws-icon"
            type="url"
            value={iconUrl}
            disabled={!canEdit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setIconUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 text-sm text-[var(--st-text)] focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-[var(--st-border)] dark:bg-[var(--st-text)] dark:text-white"
          />
        </Field>

        <div className="flex items-center justify-end gap-3">
          {ok && <span className="text-[13px] text-[var(--st-text)]">{ok}</span>}
          {error && <span className="text-[13px] text-[var(--st-text)]">{error}</span>}
          <button
            type="submit"
            disabled={!canEdit || !dirty || saving}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary,#f76808)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Panel>

      <Panel
        tone="danger"
        title="Danger zone"
        description="Deleting a workspace also removes all its members and invites."
      >
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canEdit || deleting}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-4 py-2 text-[13px] font-medium text-[var(--st-text)] hover:bg-[var(--st-text)]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LuTrash2 className="h-4 w-4" aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete workspace'}
        </button>
      </Panel>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════
   Members tab
   ══════════════════════════════════════════════════════════ */

function MembersTab({
  workspaceId,
  canManage,
  isOwner,
  currentUserId,
}: {
  workspaceId: string;
  canManage: boolean;
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/members`,
        { cache: 'no-store' },
      );
      const data = (await res.json()) as {
        members?: WorkspaceMember[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load members');
      setMembers(data.members ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRoleChange = useCallback(
    async (memberId: string, role: WorkspaceRole) => {
      // Optimistic update
      const previousMembers = [...members];
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
      setError(null);

      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        // Revert on error
        setMembers(previousMembers);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to update role');
        return;
      }
      await reload();
      router.refresh();
    },
    [reload, workspaceId, router, members],
  );

  const handleRemove = useCallback(
    async (memberId: string, displayName: string) => {
      if (!confirm(`Remove ${displayName} from this workspace?`)) return;

      // Optimistic update
      const previousMembers = [...members];
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setError(null);

      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/members/${memberId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        // Revert on error
        setMembers(previousMembers);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to remove member');
        return;
      }
      await reload();
      router.refresh();
    },
    [reload, workspaceId, router, members],
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Panel title="Members" description={`${members.length} total`}>
        {error && (
          <div className="rounded-md border border-[var(--st-border)]/30 bg-[var(--st-text)]/10 p-3 text-[13px] text-[var(--st-text)]">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[var(--st-border)] dark:border-[var(--st-border)] pb-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-[13px] text-[var(--st-text)]">No members yet.</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[var(--st-border)] dark:border-[var(--st-border)]">
            <table className="w-full table-fixed text-left text-[13px]">
              <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="w-40 px-3 py-2 font-medium">Role</th>
                  <th className="w-32 px-3 py-2 font-medium">Joined</th>
                  <th className="w-20 px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isSelf = m.userId === currentUserId;
                  const canChangeRole =
                    canManage &&
                    (m.role !== 'owner' || isOwner) &&
                    !isSelf; // don't let a user demote themselves in the list
                  const canRemove =
                    m.role !== 'owner' && (canManage || isSelf);
                  const display = m.name || m.email || m.userId;
                  return (
                    <tr
                      key={m.id}
                      className="border-t border-[var(--st-border)] dark:border-[var(--st-border)]"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[12px] font-semibold uppercase text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                            {display.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[var(--st-text)] dark:text-white">
                              {m.name || m.email || 'Unknown'}
                            </div>
                            {m.email && (
                              <div className="truncate text-[12px] text-[var(--st-text)]">
                                {m.email}
                              </div>
                            )}
                          </div>
                          {m.role === 'owner' && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)]">
                              <LuCrown className="h-3 w-3" aria-hidden="true" />
                              Owner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={m.role}
                          disabled={!canChangeRole}
                          onChange={(e) =>
                            handleRoleChange(m.id, e.target.value as WorkspaceRole)
                          }
                          className="w-full rounded-md border border-[var(--st-border)] bg-white px-2 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--st-border)] dark:bg-[var(--st-text)]"
                        >
                          {ROLE_OPTIONS.filter(
                            (o) => o.value !== 'owner' || isOwner,
                          ).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-[var(--st-text)]">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canRemove ? (
                          <button
                            type="button"
                            onClick={() => handleRemove(m.id, display)}
                            aria-label={`Remove ${display}`}
                            className="inline-flex items-center rounded-md p-1.5 text-[var(--st-text)] hover:bg-[var(--st-text)]/10 hover:text-[var(--st-text)]"
                          >
                            <LuTrash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Invites tab
   ══════════════════════════════════════════════════════════ */

function InvitesTab({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) {
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/invites`,
        { cache: 'no-store' },
      );
      const data = (await res.json()) as {
        invites?: WorkspaceInvite[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load invites');
      setInvites(data.invites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSend = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSending(true);
      setError(null);
      setLastInviteUrl(null);
      try {
        const res = await fetch(
          `/api/sabflow/workspaces/${workspaceId}/invites`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role }),
          },
        );
        const data = (await res.json()) as {
          invite?: WorkspaceInvite;
          inviteUrl?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'Failed to send invite');
        setEmail('');
        setRole('editor');
        setLastInviteUrl(data.inviteUrl ?? null);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send invite');
      } finally {
        setSending(false);
      }
    },
    [email, reload, role, workspaceId],
  );

  const handleRevoke = useCallback(
    async (inviteId: string) => {
      if (!confirm('Revoke this invite?')) return;

      // Optimistic update
      const previousInvites = [...invites];
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      setError(null);

      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        // Revert on error
        setInvites(previousInvites);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to revoke invite');
        return;
      }
      await reload();
    },
    [reload, workspaceId, invites],
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      {canManage && (
        <Panel title="Invite a member">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSend}>
            <Field label="Email" htmlFor="invite-email" className="flex-1">
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-[var(--st-border)] dark:bg-[var(--st-text)] dark:text-white"
              />
            </Field>
            <Field label="Role" htmlFor="invite-role" className="w-40">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 text-sm dark:border-[var(--st-border)] dark:bg-[var(--st-text)] dark:text-white"
              >
                {INVITE_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary,#f76808)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <LuUserPlus className="h-4 w-4" aria-hidden="true" />
              {sending ? 'Sending…' : 'Send invite'}
            </button>
          </form>

          {lastInviteUrl && (
            <div className="mt-3 rounded-md border border-[var(--st-border)]/30 bg-[var(--st-text)]/10 p-3 text-[12px]">
              <div className="font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                Invite created. Share this link:
              </div>
              <code className="mt-1 block break-all text-[var(--st-text)] dark:text-white">
                {lastInviteUrl}
              </code>
            </div>
          )}
        </Panel>
      )}

      <Panel title="Pending invites">
        {error && (
          <div className="rounded-md border border-[var(--st-border)]/30 bg-[var(--st-text)]/10 p-3 text-[13px] text-[var(--st-text)]">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] dark:border-[var(--st-border)] pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            ))}
          </div>
        ) : invites.length === 0 ? (
          <div className="text-[13px] text-[var(--st-text)]">No pending invites.</div>
        ) : (
          <ul className="divide-y divide-[var(--st-border)] dark:divide-[var(--st-border)]">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <LuMail
                      className="h-4 w-4 text-[var(--st-text-secondary)]"
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium text-[var(--st-text)] dark:text-white">
                      {inv.email}
                    </span>
                    <span className="rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                      {inv.role}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--st-text)]">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    aria-label={`Revoke invite for ${inv.email}`}
                    className="inline-flex items-center rounded-md p-1.5 text-[var(--st-text)] hover:bg-[var(--st-text)]/10 hover:text-[var(--st-text)]"
                  >
                    <LuTrash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Billing tab
   ══════════════════════════════════════════════════════════ */

function BillingTab({ workspace }: { workspace: Workspace }) {
  const plan = workspace.plan ?? 'free';
  return (
    <div className="flex flex-col gap-4 py-2">
      <Panel title="Current plan">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text-secondary)]">
              <LuShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold capitalize text-[var(--st-text)] dark:text-white">
                {plan} plan
              </div>
              <div className="text-[13px] text-[var(--st-text)]">
                {plan === 'free'
                  ? 'Basic features with usage limits.'
                  : 'Thanks for supporting SabFlow!'}
              </div>
            </div>
          </div>
          <a
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary,#f76808)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            {plan === 'free' ? 'Upgrade' : 'Manage plan'}
          </a>
        </div>
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Audit tab
   ══════════════════════════════════════════════════════════ */

interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  target?: string;
  createdAt: string;
  ipAddress?: string;
}

function AuditTab({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabflow/workspaces/${workspaceId}/audit-logs`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load audit logs');
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (canManage) {
      void reload();
    } else {
      setLoading(false);
    }
  }, [reload, canManage]);

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4 py-2">
        <Panel title="Audit Log">
          <div className="text-[13px] text-[var(--st-text)]">
            You do not have permission to view audit logs for this workspace.
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <Panel title="Audit Log" description="Recent workspace activity.">
        {error && (
          <div className="rounded-md border border-[var(--st-border)]/30 bg-[var(--st-text)]/10 p-3 text-[13px] text-[var(--st-text)]">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-[var(--st-border)] dark:border-[var(--st-border)] pb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-[13px] text-[var(--st-text)]">No activity found.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--st-border)] dark:border-[var(--st-border)]">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--st-border)] dark:divide-[var(--st-border)]">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2.5 font-medium text-[var(--st-text)] dark:text-white">
                      {entry.action}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-mono text-[12px]">
                      {entry.userId}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                      {entry.target || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--st-text)] whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Small local primitives
   ══════════════════════════════════════════════════════════ */

function Panel({
  title,
  description,
  tone,
  children,
}: {
  title?: string;
  description?: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-lg border p-5',
        tone === 'danger'
          ? 'border-[var(--st-border)]/30 bg-[var(--st-text)]/5'
          : 'border-[var(--st-border)] bg-white dark:border-[var(--st-border)] dark:bg-[var(--st-text)]/40',
      )}
    >
      {(title || description) && (
        <header className="flex flex-col gap-0.5">
          {title && (
            <h2 className="text-[15px] font-semibold text-[var(--st-text)] dark:text-white">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-[13px] text-[var(--st-text)]">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-[12px] font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]"
      >
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px] text-[var(--st-text)]">{hint}</span>}
    </div>
  );
}
