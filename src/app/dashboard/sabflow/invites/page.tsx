'use client';

/**
 * /dashboard/sabflow/invites — workspace invite inbox + outbox.
 *
 * "Pending invites" are ones sent to the current user (accept / decline).
 * "Sent invites" are ones the current user has sent out (status tracking).
 * Data is currently mocked client-side; wire to a server action once the
 * SabFlow invite list endpoint exists.
 */

import { useMemo, useState } from 'react';
import {
  LuMailPlus,
  LuMailOpen,
  LuCheck,
  LuX,
  LuClock,
  LuCircleX,
  LuSend,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type SentStatus = 'pending' | 'accepted' | 'expired';

interface IncomingInvite {
  id: string;
  workspaceName: string;
  invitedBy: string;
  role: 'admin' | 'member';
  sentAt: string;
}

interface SentInvite {
  id: string;
  email: string;
  workspaceName: string;
  role: 'admin' | 'member';
  status: SentStatus;
  sentAt: string;
}

// Placeholders; replace with server actions once available.
const INCOMING_SEED: IncomingInvite[] = [
  {
    id: 'inv_1',
    workspaceName: 'Acme Inc.',
    invitedBy: 'sara@acme.com',
    role: 'admin',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
];

const SENT_SEED: SentInvite[] = [
  {
    id: 'inv_a',
    email: 'jane@example.com',
    workspaceName: 'Personal',
    role: 'member',
    status: 'pending',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'inv_b',
    email: 'paul@example.com',
    workspaceName: 'Personal',
    role: 'admin',
    status: 'accepted',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: 'inv_c',
    email: 'alex@example.com',
    workspaceName: 'Personal',
    role: 'member',
    status: 'expired',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
  },
];

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

const STATUS_STYLES: Record<SentStatus, string> = {
  pending: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  accepted: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  expired: 'bg-[var(--st-text)]/40 text-[var(--st-text-secondary)] border-[var(--st-border)]/60',
};

const STATUS_ICONS: Record<SentStatus, React.ReactNode> = {
  pending: <LuClock className="w-3 h-3" />,
  accepted: <LuCheck className="w-3 h-3" />,
  expired: <LuCircleX className="w-3 h-3" />,
};

export default function SabFlowInvitesPage() {
  const [incoming, setIncoming] = useState<IncomingInvite[]>(INCOMING_SEED);
  const [sent] = useState<SentInvite[]>(SENT_SEED);
  const [working, setWorking] = useState<string | null>(null);

  const hasAny = incoming.length > 0 || sent.length > 0;

  function respond(id: string) {
    setWorking(id);
    setTimeout(() => {
      setIncoming((prev) => prev.filter((i) => i.id !== id));
      setWorking(null);
    }, 300);
  }

  const sentByStatus = useMemo(() => {
    const counts: Record<SentStatus, number> = { pending: 0, accepted: 0, expired: 0 };
    for (const s of sent) counts[s.status] += 1;
    return counts;
  }, [sent]);

  return (
    <div className="min-h-screen bg-[var(--st-text)] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--st-text)] mb-1">
              SabFlow
            </p>
            <h1 className="text-2xl font-bold text-white">Invites</h1>
            <p className="text-sm text-[var(--st-text-secondary)] mt-1">
              Workspace invites sent to you, and ones you&apos;ve sent out.
            </p>
          </div>
          <button
            type="button"
            onClick={() => alert('Send invite flow — wire to /workspaces/[id]/settings → members')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] text-sm font-medium hover:bg-white transition-colors"
          >
            <LuMailPlus className="w-4 h-4" />
            Send invite
          </button>
        </div>

        {!hasAny ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {/* Incoming */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">
                  Pending invites
                </h2>
                <span className="text-xs text-[var(--st-text)]">
                  {incoming.length} pending
                </span>
              </div>

              {incoming.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-text)]/20 px-4 py-6 text-center text-sm text-[var(--st-text)]">
                  No pending invites for you.
                </div>
              ) : (
                <div className="space-y-2">
                  {incoming.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--st-border)] bg-[var(--st-text)]/40 p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--st-text)] text-[var(--st-text-secondary)] shrink-0">
                          <LuMailOpen className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">
                            <span className="font-semibold">{inv.workspaceName}</span>{' '}
                            invited you as{' '}
                            <span className="font-mono text-xs text-[var(--st-text-secondary)] bg-[var(--st-text)] rounded px-1.5 py-0.5">
                              {inv.role}
                            </span>
                          </p>
                          <p className="text-xs text-[var(--st-text)] mt-0.5">
                            from {inv.invitedBy} · {timeAgo(inv.sentAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => respond(inv.id)}
                          disabled={working === inv.id}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                            working === inv.id
                              ? 'bg-[var(--st-text)] text-[var(--st-text)] cursor-not-allowed'
                              : 'bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-white',
                          )}
                        >
                          <LuCheck className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          onClick={() => respond(inv.id)}
                          disabled={working === inv.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-text)]/50 text-xs font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <LuX className="w-3.5 h-3.5" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sent */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">
                  Invites you&apos;ve sent
                </h2>
                <span className="text-xs text-[var(--st-text)]">
                  {sentByStatus.pending} pending · {sentByStatus.accepted} accepted ·{' '}
                  {sentByStatus.expired} expired
                </span>
              </div>

              {sent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-text)]/20 px-4 py-6 text-center text-sm text-[var(--st-text)]">
                  You haven&apos;t sent any invites yet.
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--st-border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--st-text)] border-b border-[var(--st-border)]">
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--st-text)] uppercase tracking-wider">
                          Email
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--st-text)] uppercase tracking-wider">
                          Workspace
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--st-text)] uppercase tracking-wider">
                          Role
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--st-text)] uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-[var(--st-text)] uppercase tracking-wider">
                          Sent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--st-border)]/60">
                      {sent.map((s) => (
                        <tr key={s.id} className="hover:bg-[var(--st-text)]/50 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">
                            {s.email}
                          </td>
                          <td className="px-4 py-3 text-[var(--st-text-secondary)]">
                            {s.workspaceName}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--st-text)] text-[var(--st-text-secondary)] border border-[var(--st-border)]/60">
                              {s.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
                                STATUS_STYLES[s.status],
                              )}
                            >
                              {STATUS_ICONS[s.status]}
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--st-text-secondary)] text-xs">
                            {timeAgo(s.sentAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--st-text)] flex items-center justify-center mb-4">
        <LuSend className="w-5 h-5 text-[var(--st-text-secondary)]" />
      </div>
      <p className="text-[var(--st-text-secondary)] font-medium">No invites yet</p>
      <p className="text-sm text-[var(--st-text)] mt-1 max-w-sm">
        Invite teammates to a workspace to collaborate on flows, share
        credentials, and review runs together.
      </p>
      <button
        type="button"
        onClick={() => alert('Send invite flow — wire to /workspaces/[id]/settings → members')}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] text-sm font-medium hover:bg-white transition-colors"
      >
        <LuMailPlus className="w-4 h-4" />
        Send invite
      </button>
    </div>
  );
}
