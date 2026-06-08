'use client';

/**
 * Full SabFlow workspace settings page.
 *
 * Tabs: General / Members / Invites / Audit Log / Billing
 *
 * The component is self-contained: it does its own fetching to all the
 * `/api/sabflow/workspaces/*` endpoints. The parent just needs to pass
 * the workspaceId and the initial workspace (from the server page).
 */

import {
  Alert,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TBody,
  Td,
  THead,
  Th,
  Tr,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Building,
  CreditCard,
  Crown,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  History,
} from 'lucide-react';
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

/* -- Types -------------------------------------------------- */

type Tab = 'general' | 'members' | 'invites' | 'billing' | 'audit';

interface Props {
  workspaceId: string;
  initialWorkspace: Workspace;
  /** Role of the currently-logged-in viewer, for permission-aware UI. */
  currentUserRole: WorkspaceRole;
  /** Currently logged-in user id - used to prevent self-role-demotion. */
  currentUserId: string;
}

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== 'owner');

/* -- Root component ---------------------------------------- */

export function WorkspaceSettingsPage({
  workspaceId,
  initialWorkspace,
  currentUserRole,
  currentUserId,
}: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }> }[] =
    useMemo(
      () => [
        { id: 'general', label: 'General', icon: Building },
        { id: 'members', label: 'Members', icon: Users },
        { id: 'invites', label: 'Invites', icon: Mail },
        { id: 'audit', label: 'Audit Log', icon: History },
        { id: 'billing', label: 'Billing', icon: CreditCard },
      ],
      [],
    );

  return (
    <div className="20ui mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <PageHeader>
        <div className="flex items-center gap-3">
          <Avatar data-shape="square">
            {workspace.iconUrl ? (
              <AvatarImage src={workspace.iconUrl} alt="" />
            ) : null}
            <AvatarFallback>
              <Building size={20} aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <PageHeaderHeading>
            <PageTitle>{workspace.name}</PageTitle>
            <PageDescription>Workspace settings</PageDescription>
          </PageHeaderHeading>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Workspace settings">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <span className="inline-flex items-center gap-2">
                <Icon size={14} aria-hidden="true" />
                {label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <GeneralTab
            workspace={workspace}
            canEdit={canManageWorkspace(currentUserRole)}
            onUpdated={setWorkspace}
          />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab
            workspaceId={workspaceId}
            canManage={canManageMembers(currentUserRole)}
            isOwner={currentUserRole === 'owner'}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesTab
            workspaceId={workspaceId}
            canManage={canManageMembers(currentUserRole)}
          />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab
            workspaceId={workspaceId}
            canManage={canManageWorkspace(currentUserRole)}
          />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab workspace={workspace} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WorkspaceSettingsPage;

/* ==========================================================
   General tab
   ========================================================== */

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
  const { toast } = useToast();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [iconUrl, setIconUrl] = useState(workspace.iconUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== workspace.name ||
    slug !== workspace.slug ||
    iconUrl !== (workspace.iconUrl ?? '');

  const handleSave = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
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
        toast.success('Workspace saved');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        setError(message);
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [iconUrl, name, onUpdated, slug, toast, workspace.id],
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
      const message = err instanceof Error ? err.message : 'Failed to delete';
      setError(message);
      toast.error(message);
      setDeleting(false);
    }
  }, [router, toast, workspace.id, workspace.name]);

  return (
    <form className="flex flex-col gap-6 py-2" onSubmit={handleSave}>
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Workspace details</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Field label="Name">
            <Input
              value={name}
              disabled={!canEdit}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Slug" help="Lowercase letters, numbers and dashes.">
            <Input
              value={slug}
              disabled={!canEdit}
              onChange={(e) => setSlug(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Icon">
            <SabFileUrlInput
              value={iconUrl}
              onChange={(v) => setIconUrl(v)}
              accept="image"
              disabled={!canEdit}
              placeholder="No icon chosen"
              pickerTitle="Choose a workspace icon"
            />
          </Field>

          <div className="flex items-center justify-end gap-3">
            {error ? (
              <span className="text-[13px] text-[var(--st-danger)]">{error}</span>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!canEdit || !dirty || saving}
            >
              {saving ? 'Saving' : 'Save changes'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting a workspace also removes all its members and invites.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Button
            type="button"
            variant="danger"
            iconLeft={Trash2}
            loading={deleting}
            disabled={!canEdit || deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting' : 'Delete workspace'}
          </Button>
        </CardBody>
      </Card>
    </form>
  );
}

/* ==========================================================
   Members tab
   ========================================================== */

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
  const { toast } = useToast();
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
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
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
        const message = data.error ?? 'Failed to update role';
        setError(message);
        toast.error(message);
        return;
      }
      await reload();
      router.refresh();
    },
    [reload, workspaceId, router, members, toast],
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
        const message = data.error ?? 'Failed to remove member';
        setError(message);
        toast.error(message);
        return;
      }
      await reload();
      router.refresh();
    },
    [reload, workspaceId, router, members, toast],
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{`${members.length} total`}</CardDescription>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {error ? (
            <Alert tone="danger">{error}</Alert>
          ) : null}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-[var(--st-border)] pb-3"
                >
                  <Skeleton circle width={32} />
                  <div className="flex-1 space-y-2">
                    <Skeleton height={16} width="33%" />
                    <Skeleton height={12} width="25%" />
                  </div>
                  <Skeleton height={32} width={96} radius={8} />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="No members yet" />
          ) : (
            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Member</Th>
                    <Th width={160}>Role</Th>
                    <Th width={128}>Joined</Th>
                    <Th width={80} align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
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
                      <Tr key={m.id}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Avatar name={m.name || m.email || 'Unknown'} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[var(--st-text)]">
                                {m.name || m.email || 'Unknown'}
                              </div>
                              {m.email ? (
                                <div className="truncate text-[12px] text-[var(--st-text-secondary)]">
                                  {m.email}
                                </div>
                              ) : null}
                            </div>
                            {m.role === 'owner' ? (
                              <Badge tone="accent" className="ml-1">
                                <span className="inline-flex items-center gap-1">
                                  <Crown size={12} aria-hidden="true" />
                                  Owner
                                </span>
                              </Badge>
                            ) : null}
                          </div>
                        </Td>
                        <Td>
                          <Select
                            value={m.role}
                            disabled={!canChangeRole}
                            onValueChange={(v) =>
                              handleRoleChange(m.id, v as WorkspaceRole)
                            }
                          >
                            <SelectTrigger aria-label={`Role for ${display}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.filter(
                                (o) => o.value !== 'owner' || isOwner,
                              ).map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </Td>
                        <Td align="right">
                          {canRemove ? (
                            <IconButton
                              label={`Remove ${display}`}
                              icon={Trash2}
                              size="sm"
                              onClick={() => handleRemove(m.id, display)}
                            />
                          ) : (
                            <span className="text-[var(--st-text-tertiary)]">-</span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ==========================================================
   Invites tab
   ========================================================== */

function InvitesTab({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
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
        toast.success('Invite sent');
        await reload();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send invite';
        setError(message);
        toast.error(message);
      } finally {
        setSending(false);
      }
    },
    [email, reload, role, workspaceId, toast],
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
        const message = data.error ?? 'Failed to revoke invite';
        setError(message);
        toast.error(message);
        return;
      }
      await reload();
    },
    [reload, workspaceId, invites, toast],
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      {canManage ? (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={handleSend}
            >
              <Field label="Email" className="flex-1">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </Field>
              <Field label="Role" className="w-40">
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as WorkspaceRole)}
                >
                  <SelectTrigger aria-label="Invite role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="submit"
                variant="primary"
                iconLeft={UserPlus}
                loading={sending}
                disabled={sending}
              >
                {sending ? 'Sending' : 'Send invite'}
              </Button>
            </form>

            {lastInviteUrl ? (
              <Alert tone="success" title="Invite created. Share this link:">
                <code className="mt-1 block break-all text-[12px] text-[var(--st-text)]">
                  {lastInviteUrl}
                </code>
              </Alert>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {error ? (
            <Alert tone="danger">{error}</Alert>
          ) : null}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] pb-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton height={16} width={16} />
                    <Skeleton height={16} width={128} />
                    <Skeleton height={16} width={64} radius={9999} />
                  </div>
                  <Skeleton height={32} width={32} radius={8} />
                </div>
              ))}
            </div>
          ) : invites.length === 0 ? (
            <EmptyState icon={Mail} title="No pending invites" />
          ) : (
            <ul className="divide-y divide-[var(--st-border)]">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Mail
                        size={16}
                        className="text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium text-[var(--st-text)]">
                        {inv.email}
                      </span>
                      <Badge tone="neutral">{inv.role}</Badge>
                    </div>
                    <div className="text-[12px] text-[var(--st-text-secondary)]">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  {canManage ? (
                    <IconButton
                      label={`Revoke invite for ${inv.email}`}
                      icon={Trash2}
                      size="sm"
                      onClick={() => handleRevoke(inv.id)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ==========================================================
   Billing tab
   ========================================================== */

function BillingTab({ workspace }: { workspace: Workspace }) {
  const plan = workspace.plan ?? 'free';
  return (
    <div className="flex flex-col gap-4 py-2">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                aria-hidden="true"
              >
                <ShieldCheck size={20} />
              </span>
              <div>
                <div className="font-semibold capitalize text-[var(--st-text)]">
                  {plan} plan
                </div>
                <div className="text-[13px] text-[var(--st-text-secondary)]">
                  {plan === 'free'
                    ? 'Basic features with usage limits.'
                    : 'Thanks for supporting SabFlow.'}
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={() => { window.location.href = '/dashboard/billing'; }}>
              {plan === 'free' ? 'Upgrade' : 'Manage plan'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ==========================================================
   Audit tab
   ========================================================== */

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
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-[13px] text-[var(--st-text-secondary)]">
              You do not have permission to view audit logs for this workspace.
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Recent workspace activity.</CardDescription>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {error ? (
            <Alert tone="danger">{error}</Alert>
          ) : null}
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-[var(--st-border)] pb-3"
                >
                  <Skeleton height={16} width={96} />
                  <Skeleton height={16} width={128} />
                  <Skeleton height={16} width={192} />
                  <Skeleton height={16} width={80} />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={History} title="No activity found" />
          ) : (
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Action</Th>
                    <Th>User</Th>
                    <Th>Target</Th>
                    <Th>Time</Th>
                  </Tr>
                </THead>
                <TBody>
                  {entries.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="font-medium text-[var(--st-text)]">
                        {entry.action}
                      </Td>
                      <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                        {entry.userId}
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">
                        {entry.target || '-'}
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--st-text-secondary)]">
                        {new Date(entry.createdAt).toLocaleString()}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
