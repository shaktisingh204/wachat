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

type Tab = 'general' | 'members' | 'invites' | 'billing';

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
        { id: 'billing', label: 'Billing', icon: LuCreditCard },
      ],
      [],
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {workspace.name}
          </h1>
          <p className="text-[13px] text-gray-500">Workspace settings</p>
        </div>
      </header>

      <nav
        role="tablist"
        aria-label="Workspace settings"
        className="flex gap-1 border-b border-gray-200 dark:border-zinc-800"
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
                  ? 'border-b-2 border-[var(--color-primary,#f76808)] text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-zinc-200',
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
        {tab === 'invites' && (
          <InvitesTab
            workspaceId={workspaceId}
            canManage={canManageMembers(currentUserRole)}
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
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </Field>

        <div className="flex items-center justify-end gap-3">
          {ok && <span className="text-[13px] text-emerald-600">{ok}</span>}
          {error && <span className="text-[13px] text-red-600">{error}</span>}
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
          className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to update role');
        return;
      }
      await reload();
    },
    [reload, workspaceId],
  );

  const handleRemove = useCallback(
    async (memberId: string, displayName: string) => {
      if (!confirm(`Remove ${displayName} from this workspace?`)) return;
      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/members/${memberId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to remove member');
        return;
      }
      await reload();
    },
    [reload, workspaceId],
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Panel title="Members" description={`${members.length} total`}>
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-600">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-[13px] text-gray-500">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="text-[13px] text-gray-500">No members yet.</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200 dark:border-zinc-800">
            <table className="w-full table-fixed text-left text-[13px]">
              <thead className="bg-gray-50 text-gray-600 dark:bg-zinc-900/40 dark:text-zinc-400">
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
                    m.role !== 'owner' &&
                    !isSelf; // don't let a user demote themselves in the list
                  const canRemove =
                    m.role !== 'owner' && (canManage || isSelf);
                  const display = m.name || m.email || m.userId;
                  return (
                    <tr
                      key={m.id}
                      className="border-t border-gray-100 dark:border-zinc-800"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold uppercase text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {display.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900 dark:text-white">
                              {m.name || m.email || 'Unknown'}
                            </div>
                            {m.email && (
                              <div className="truncate text-[12px] text-gray-500">
                                {m.email}
                              </div>
                            )}
                          </div>
                          {m.role === 'owner' && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
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
                          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
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
                      <td className="px-3 py-3 text-gray-500">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canRemove ? (
                          <button
                            type="button"
                            onClick={() => handleRemove(m.id, display)}
                            aria-label={`Remove ${display}`}
                            className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-600"
                          >
                            <LuTrash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
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
      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Failed to revoke invite');
        return;
      }
      await reload();
    },
    [reload, workspaceId],
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
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[var(--color-primary,#f76808)] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </Field>
            <Field label="Role" htmlFor="invite-role" className="w-40">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
            <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12px]">
              <div className="font-medium text-emerald-700 dark:text-emerald-300">
                Invite created. Share this link:
              </div>
              <code className="mt-1 block break-all text-emerald-800 dark:text-emerald-200">
                {lastInviteUrl}
              </code>
            </div>
          )}
        </Panel>
      )}

      <Panel title="Pending invites">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-600">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-[13px] text-gray-500">Loading…</div>
        ) : invites.length === 0 ? (
          <div className="text-[13px] text-gray-500">No pending invites.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <LuMail
                      className="h-4 w-4 text-gray-400"
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium text-gray-900 dark:text-white">
                      {inv.email}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {inv.role}
                    </span>
                  </div>
                  <div className="text-[12px] text-gray-500">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    aria-label={`Revoke invite for ${inv.email}`}
                    className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-600"
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
              <LuShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold capitalize text-gray-900 dark:text-white">
                {plan} plan
              </div>
              <div className="text-[13px] text-gray-500">
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
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40',
      )}
    >
      {(title || description) && (
        <header className="flex flex-col gap-0.5">
          {title && (
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-[13px] text-gray-500">{description}</p>
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
        className="text-[12px] font-medium text-gray-700 dark:text-zinc-300"
      >
        {label}
      </label>
      {children}
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </div>
  );
}
