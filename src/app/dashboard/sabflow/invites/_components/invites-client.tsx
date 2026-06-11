'use client';

/**
 * Invite inbox + outbox for /dashboard/sabflow/invites.
 *
 * Data comes from GET /api/sabflow/workspaces/invites:
 *   - incoming: invites addressed to the session user (accept / decline)
 *   - sent:     pending invites in workspaces the user can manage (revoke)
 *
 * Accept posts to /api/sabflow/workspaces/invites/accept/[token] (the same
 * endpoint the invite-link page uses); decline / revoke delete the invite via
 * /api/sabflow/workspaces/[workspaceId]/invites/[inviteId].
 */

import * as React from 'react';
import Link from 'next/link';
import {
  MailPlus,
  MailOpen,
  Check,
  X,
  Clock,
  CircleX,
  CircleAlert,
  Send,
  RotateCw,
} from 'lucide-react';

import {
  Button,
  Badge,
  Card,
  CardBody,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

/* ── Types (mirror the GET route's response shape) ────────── */

type InviteRole = 'owner' | 'admin' | 'editor' | 'viewer';
type SentStatus = 'pending' | 'expired';

interface IncomingInvite {
  id: string;
  token: string;
  workspaceId: string;
  workspaceName: string;
  role: InviteRole;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

interface SentInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: InviteRole;
  createdAt: string;
  expiresAt: string;
}

interface InvitesPayload {
  incoming: IncomingInvite[];
  sent: SentInvite[];
}

/* ── Helpers ──────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function sentStatus(inv: SentInvite): SentStatus {
  return new Date(inv.expiresAt).getTime() < Date.now() ? 'expired' : 'pending';
}

const STATUS_TONE: Record<SentStatus, BadgeTone> = {
  pending: 'warning',
  expired: 'neutral',
};

const STATUS_ICON: Record<SentStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" aria-hidden="true" />,
  expired: <CircleX className="h-3 w-3" aria-hidden="true" />,
};

/* ── Loading skeleton (also used as the Suspense fallback) ── */

export function InvitesSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading invites">
      {[0, 1].map((section) => (
        <section key={section}>
          <div className="mb-3 h-4 w-36 animate-pulse rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]" />
          <div className="space-y-2">
            {[0, 1].map((row) => (
              <Card key={row} variant="outlined" padding="none">
                <CardBody className="flex items-center gap-3 p-4">
                  <span className="h-9 w-9 shrink-0 animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-1/3 animate-pulse rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]" />
                    <div className="h-3 w-1/4 animate-pulse rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Main client ──────────────────────────────────────────── */

export function InvitesClient(): React.JSX.Element {
  const { toast } = useToast();
  const [data, setData] = React.useState<InvitesPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState<string | null>(null);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/sabflow/workspaces/invites', {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as Partial<InvitesPayload> & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load invites');
      setData({ incoming: json.incoming ?? [], sent: json.sent ?? [] });
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load invites');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function accept(inv: IncomingInvite) {
    setWorking(inv.id);
    try {
      const res = await fetch(
        `/api/sabflow/workspaces/invites/accept/${inv.token}`,
        { method: 'POST' },
      );
      const json = (await res.json().catch(() => ({}))) as {
        workspaceId?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Failed to accept invite');
      setData((prev) =>
        prev
          ? { ...prev, incoming: prev.incoming.filter((i) => i.id !== inv.id) }
          : prev,
      );
      toast.success(`Invite accepted — you joined ${inv.workspaceName}.`);
      void load(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to accept invite',
      );
    } finally {
      setWorking(null);
    }
  }

  async function removeInvite(
    kind: 'decline' | 'revoke',
    workspaceId: string,
    inviteId: string,
  ) {
    setWorking(inviteId);
    try {
      const res = await fetch(
        `/api/sabflow/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: 'DELETE' },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          json.error ?? `Failed to ${kind === 'decline' ? 'decline' : 'revoke'} invite`,
        );
      }
      setData((prev) =>
        prev
          ? {
              incoming: prev.incoming.filter((i) => i.id !== inviteId),
              sent: prev.sent.filter((s) => s.id !== inviteId),
            }
          : prev,
      );
      if (kind === 'decline') toast({ title: 'Invite declined.' });
      else toast.success('Invite revoked.');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${kind === 'decline' ? 'decline' : 'revoke'} invite`,
      );
    } finally {
      setWorking(null);
    }
  }

  if (loading && !data) return <InvitesSkeleton />;

  if (error && !data) {
    return (
      <EmptyState
        icon={CircleAlert}
        tone="danger"
        title="Could not load invites"
        description={error}
        action={
          <Button variant="outline" iconLeft={RotateCw} onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  }

  const incoming = data?.incoming ?? [];
  const sent = data?.sent ?? [];
  const hasAny = incoming.length > 0 || sent.length > 0;

  if (!hasAny) {
    return (
      <EmptyState
        icon={Send}
        title="No invites yet"
        description="Invite teammates to a workspace to collaborate on flows, share credentials, and review runs together."
        action={
          <Button asChild variant="primary">
            <Link href="/dashboard/sabflow/workspaces">
              <MailPlus aria-hidden="true" />
              Send invite
            </Link>
          </Button>
        }
      />
    );
  }

  const sentCounts = sent.reduce(
    (acc, s) => {
      acc[sentStatus(s)] += 1;
      return acc;
    },
    { pending: 0, expired: 0 } as Record<SentStatus, number>,
  );

  return (
    <div className="space-y-8">
      {/* Incoming */}
      <section aria-label="Pending invites for you">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--st-text)]">
            Pending invites
          </h2>
          <span className="text-xs text-[var(--st-text-tertiary)]">
            {incoming.length} pending
          </span>
        </div>

        {incoming.length === 0 ? (
          <Card variant="outlined" padding="none">
            <CardBody className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
              No pending invites for you.
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2">
            {incoming.map((inv) => (
              <Card key={inv.id} variant="outlined" padding="none">
                <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                      <MailOpen className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--st-text)]">
                        <span className="font-semibold">{inv.workspaceName}</span>{' '}
                        invited you as{' '}
                        <Badge tone="neutral" kind="soft">
                          {inv.role}
                        </Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--st-text-tertiary)]">
                        {inv.invitedBy ? `from ${inv.invitedBy}, ` : ''}
                        {timeAgo(inv.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={Check}
                      loading={working === inv.id}
                      onClick={() => void accept(inv)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={X}
                      disabled={working === inv.id}
                      onClick={() =>
                        void removeInvite('decline', inv.workspaceId, inv.id)
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Sent */}
      <section aria-label="Invites you have sent">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--st-text)]">
            Invites you have sent
          </h2>
          <span className="text-xs text-[var(--st-text-tertiary)]">
            {sentCounts.pending} pending, {sentCounts.expired} expired
          </span>
        </div>

        {sent.length === 0 ? (
          <Card variant="outlined" padding="none">
            <CardBody className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
              You have not sent any invites yet.
            </CardBody>
          </Card>
        ) : (
          <Card variant="outlined" padding="none" className="overflow-hidden">
            <Table>
              <THead>
                <Tr>
                  <Th>Email</Th>
                  <Th>Workspace</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Sent</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {sent.map((s) => {
                  const status = sentStatus(s);
                  return (
                    <Tr key={s.id}>
                      <Td className="font-medium text-[var(--st-text)]">
                        {s.email}
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">
                        {s.workspaceName}
                      </Td>
                      <Td>
                        <Badge tone="neutral" kind="soft">
                          {s.role}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge
                          tone={STATUS_TONE[status]}
                          kind="soft"
                          className="capitalize"
                        >
                          <span className="inline-flex items-center gap-1">
                            {STATUS_ICON[status]}
                            {status}
                          </span>
                        </Badge>
                      </Td>
                      <Td className="text-xs text-[var(--st-text-secondary)]">
                        {timeAgo(s.createdAt)}
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={X}
                          loading={working === s.id}
                          onClick={() =>
                            void removeInvite('revoke', s.workspaceId, s.id)
                          }
                        >
                          Revoke
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}

export default InvitesClient;
