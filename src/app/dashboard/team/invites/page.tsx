'use client';

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  SegmentedControl,
  Skeleton,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';
import {
  UserPlus,
  RefreshCw,
  CircleX,
  Mail,
  Clock,
  Copy,
  Check,
  CheckCircle2,
  Send,
} from 'lucide-react';

import {
  listPendingInvitations,
  resendInvitation,
  revokeInvitation,
  type InvitationView,
} from '@/app/actions/team.actions';

type Filter = 'all' | 'pending' | 'expired' | 'accepted';

export default function TeamInvitesPage() {
  const [invites, setInvites] = useState<InvitationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const refresh = () => {
    setLoading(true);
    listPendingInvitations()
      .then(setInvites)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleResend = (id: string) => {
    startTransition(async () => {
      const res = await resendInvitation(id);
      if (res.error) {
        toast.error({ title: 'Failed', description: res.error });
      } else {
        toast.success('Invite resent');
        refresh();
      }
    });
  };

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      const res = await revokeInvitation(id);
      if (res.error) {
        toast.error({ title: 'Failed', description: res.error });
      } else {
        toast.success('Invitation revoked');
        refresh();
      }
    });
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const visible = invites
    .filter((i) => {
      if (filter === 'all') return true;
      if (filter === 'expired') return i.status === 'expired' || i.isExpired;
      if (filter === 'pending') return i.status === 'pending' && !i.isExpired;
      return i.status === filter;
    })
    .filter(
      (i) =>
        !search ||
        i.inviteeEmail.toLowerCase().includes(search.toLowerCase()) ||
        i.projectName?.toLowerCase().includes(search.toLowerCase()),
    );

  const counts = {
    all: invites.length,
    pending: invites.filter((i) => i.status === 'pending' && !i.isExpired).length,
    expired: invites.filter((i) => i.isExpired || i.status === 'expired').length,
    accepted: invites.filter((i) => i.status === 'accepted').length,
  };

  const filterItems = (['all', 'pending', 'expired', 'accepted'] as Filter[]).map((f) => ({
    value: f,
    label: (
      <span className="capitalize">
        {f}
        <span className="ml-1.5 opacity-70">({counts[f]})</span>
      </span>
    ),
  }));

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/team">Team</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Invitations</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Invitations</PageTitle>
          <PageDescription>
            Track who has been invited to the workspace. Resend or revoke pending invites.
          </PageDescription>
        </PageHeading>
        <Button variant="ghost" size="sm" iconLeft={RefreshCw} onClick={refresh}>
          Refresh
        </Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md">
              <Skeleton width={88} height={11} radius={9999} />
              <Skeleton className="mt-3" width={40} height={26} radius={6} />
            </Card>
          ))
        ) : (
          <>
            <StatCard label="Total invites" value={counts.all} icon={Send} accent="var(--st-accent)" />
            <StatCard label="Pending" value={counts.pending} icon={Clock} />
            <StatCard label="Accepted" value={counts.accepted} icon={CheckCircle2} />
            <StatCard
              label="Expired"
              value={counts.expired}
              icon={CircleX}
              delta={counts.expired > 0 ? { value: 'Review', tone: 'down' } : undefined}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Filter>
          aria-label="Filter invitations by status"
          items={filterItems}
          value={filter}
          onChange={setFilter}
        />
        <div className="ml-auto w-full sm:w-64">
          <Input
            aria-label="Search email or project"
            placeholder="Search email or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={Mail}
          />
        </div>
      </div>

      {/* List */}
      <Card padding="none">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={56} width="100%" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No invitations match"
            description="Adjust the filter or invite a teammate from the Members page."
          />
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {visible.map((inv) => {
              const status = inv.isExpired ? 'expired' : inv.status;
              const canResend = status === 'pending' || status === 'expired';
              const canRevoke = status === 'pending';
              return (
                <li
                  key={inv._id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] text-[var(--st-text)]">
                        {inv.inviteeEmail}
                      </p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 truncate text-[12.5px] text-[var(--st-text-secondary)]">
                      {inv.projectName ?? 'Workspace-wide'} · {inv.role}
                      {inv.inviterName && ` · by ${inv.inviterName}`}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {formatRelative(inv.createdAt)} · expires {formatRelative(inv.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={copied === inv.token ? Check : Copy}
                      onClick={() => handleCopyLink(inv.token)}
                    >
                      {copied === inv.token ? 'Copied' : 'Copy link'}
                    </Button>
                    {canResend && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={RefreshCw}
                        loading={pending}
                        onClick={() => handleResend(inv._id)}
                      >
                        Resend
                      </Button>
                    )}
                    {canRevoke && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={CircleX}
                        disabled={pending}
                        onClick={() => handleRevoke(inv._id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') return <Badge tone="success">Accepted</Badge>;
  if (status === 'expired') return <Badge tone="danger">Expired</Badge>;
  if (status === 'revoked') return <Badge tone="neutral">Revoked</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: Array<[number, string]> = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [604_800_000, 'week'],
  ];
  let chosen: [number, string] = [86_400_000, 'day'];
  for (const u of units) if (abs < u[0] * 60) chosen = u;
  const n = Math.max(1, Math.round(abs / chosen[0]));
  const unit = n === 1 ? chosen[1] : `${chosen[1]}s`;
  return diff < 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}
