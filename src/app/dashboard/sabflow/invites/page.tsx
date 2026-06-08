'use client';

/**
 * /dashboard/sabflow/invites - workspace invite inbox + outbox.
 *
 * "Pending invites" are ones sent to the current user (accept / decline).
 * "Sent invites" are ones the current user has sent out (status tracking).
 * Data is currently mocked client-side; wire to a server action once the
 * SabFlow invite list endpoint exists.
 */

import { useMemo, useState } from 'react';
import {
  MailPlus,
  MailOpen,
  Check,
  X,
  Clock,
  CircleX,
  Send,
} from 'lucide-react';

import {
  Button,
  Badge,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

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

const STATUS_TONE: Record<SentStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  expired: 'neutral',
};

const STATUS_ICON: Record<SentStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" aria-hidden="true" />,
  accepted: <Check className="h-3 w-3" aria-hidden="true" />,
  expired: <CircleX className="h-3 w-3" aria-hidden="true" />,
};

export default function SabFlowInvitesPage() {
  const { toast } = useToast();
  const [incoming, setIncoming] = useState<IncomingInvite[]>(INCOMING_SEED);
  const [sent] = useState<SentInvite[]>(SENT_SEED);
  const [working, setWorking] = useState<string | null>(null);

  const hasAny = incoming.length > 0 || sent.length > 0;

  function sendInvite() {
    toast({
      title: 'Send invite',
      description: 'Wire to /workspaces/[id]/settings then members.',
      tone: 'info',
    });
  }

  function respond(id: string, accepted: boolean) {
    setWorking(id);
    setTimeout(() => {
      setIncoming((prev) => prev.filter((i) => i.id !== id));
      setWorking(null);
      if (accepted) toast.success('Invite accepted.');
      else toast('Invite declined.');
    }, 300);
  }

  const sentByStatus = useMemo(() => {
    const counts: Record<SentStatus, number> = { pending: 0, accepted: 0, expired: 0 };
    for (const s of sent) counts[s.status] += 1;
    return counts;
  }, [sent]);

  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      <div className="mx-auto max-w-5xl">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabFlow</PageEyebrow>
            <PageTitle>Invites</PageTitle>
            <PageDescription>
              Workspace invites sent to you, and ones you have sent out.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={MailPlus} onClick={sendInvite}>
              Send invite
            </Button>
          </PageActions>
        </PageHeader>

        {!hasAny ? (
          <div className="mt-8">
            <EmptyState
              icon={Send}
              title="No invites yet"
              description="Invite teammates to a workspace to collaborate on flows, share credentials, and review runs together."
              action={
                <Button variant="primary" iconLeft={MailPlus} onClick={sendInvite}>
                  Send invite
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Incoming */}
            <section>
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
                              from {inv.invitedBy}, {timeAgo(inv.sentAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            iconLeft={Check}
                            loading={working === inv.id}
                            onClick={() => respond(inv.id, true)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={X}
                            disabled={working === inv.id}
                            onClick={() => respond(inv.id, false)}
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
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">
                  Invites you have sent
                </h2>
                <span className="text-xs text-[var(--st-text-tertiary)]">
                  {sentByStatus.pending} pending, {sentByStatus.accepted} accepted,{' '}
                  {sentByStatus.expired} expired
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
                      </Tr>
                    </THead>
                    <TBody>
                      {sent.map((s) => (
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
                            <Badge tone={STATUS_TONE[s.status]} kind="soft" className="capitalize">
                              <span className="inline-flex items-center gap-1">
                                {STATUS_ICON[s.status]}
                                {s.status}
                              </span>
                            </Badge>
                          </Td>
                          <Td className="text-xs text-[var(--st-text-secondary)]">
                            {timeAgo(s.sentAt)}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </Card>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
