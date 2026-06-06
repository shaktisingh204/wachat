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
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Clock,
  FileText,
  MessageSquare,
  Shield,
  UserMinus,
  UserPlus,
} from 'lucide-react';

import * as React from 'react';

import { getActivityLogs } from '@/app/actions/activity.actions';
import { getInvitedUsers } from '@/app/actions/team.actions';
import type { ActivityLog, User, WithId } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

const PAGE_SIZE = 25;

type ActionGroup = 'all' | 'TASK' | 'MEMBER' | 'ROLE' | 'CHAT';

export default function ActivityLogPage() {
  const { activeProjectId } = useProject();
  const [logs, setLogs] = React.useState<WithId<ActivityLog>[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [actor, setActor] = React.useState('all');
  const [group, setGroup] = React.useState<ActionGroup>('all');
  const [since, setSince] = React.useState('');
  const [until, setUntil] = React.useState('');
  const [members, setMembers] = React.useState<WithId<User>[]>([]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [res, m] = await Promise.all([
      getActivityLogs(activeProjectId || undefined, page, PAGE_SIZE, {
        actorUserId: actor !== 'all' ? actor : undefined,
        actionPrefix: group !== 'all' ? group : undefined,
        sinceIso: since ? new Date(since).toISOString() : undefined,
        untilIso: until ? new Date(until + 'T23:59:59').toISOString() : undefined,
      }),
      members.length === 0 ? getInvitedUsers() : Promise.resolve(members as any),
    ]);
    setLogs(res.logs);
    setTotal(res.total);
    setTotalPages(res.totalPages || 1);
    if (Array.isArray(m) && m.length) setMembers(m as WithId<User>[]);
    setLoading(false);
  }, [activeProjectId, page, actor, group, since, until]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasFilters = actor !== 'all' || group !== 'all' || Boolean(since) || Boolean(until);

  const resetFilters = () => {
    setActor('all');
    setGroup('all');
    setSince('');
    setUntil('');
    setPage(1);
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/team/manage-users">Team</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Activity</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Activity</PageTitle>
          <PageDescription>
            Every invite, role change, task move, and chat event, in chronological order.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Actor" className="w-[180px]">
            <Select
              value={actor}
              onValueChange={(v) => {
                setActor(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by actor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m._id.toString()} value={m._id.toString()}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Event" className="w-[180px]">
            <Select
              value={group}
              onValueChange={(v) => {
                setGroup(v as ActionGroup);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by event type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="TASK">Tasks</SelectItem>
                <SelectItem value="MEMBER">Members</SelectItem>
                <SelectItem value="ROLE">Roles</SelectItem>
                <SelectItem value="CHAT">Chat</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="From" className="w-[160px]">
            <Input
              type="date"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="To" className="w-[160px]">
            <Input
              type="date"
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                setPage(1);
              }}
            />
          </Field>

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          ) : null}
        </div>
        <div className="pb-1.5 text-[12px] text-[var(--st-text-secondary)]">
          {total.toLocaleString()} event{total === 1 ? '' : 's'}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading activity" />
            <span className="text-[13px]">Loading activity</span>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No matching activity"
            description="Try broadening the filters. As your team does more, this feed fills up."
          />
        ) : (
          <div className="divide-y divide-[var(--st-border)]">
            {logs.map((log) => (
              <ActivityRow key={log._id.toString()} log={log} />
            ))}
          </div>
        )}
      </Card>

      {totalPages > 1 ? (
        <Pagination
          className="justify-end"
          page={page}
          pageCount={totalPages}
          onPageChange={(p) => setPage(p)}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------------- ROW ------------------------------------ */

function ActivityRow({ log }: { log: WithId<ActivityLog> }) {
  const { icon, tone } = iconForAction(log.action as string);
  const label = (log.user?.name || log.user?.email || 'Unknown').charAt(0).toUpperCase();
  const hue = hashHue(log.user?.email || 'x');
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px]"
        // Runtime-computed per-user avatar hue (derived from the email hash).
        style={{
          background: `hsl(${hue} 60% 90%)`,
          color: `hsl(${hue} 45% 28%)`,
        }}
      >
        {label || '?'}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[13px]">
            <span className="text-[var(--st-text)]">{log.user?.name || 'Unknown user'}</span>{' '}
            <span className="text-[var(--st-text-secondary)]">
              {actionMessage(log.action as string, log.details)}
            </span>
          </div>
          <div
            className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--st-text-secondary)]"
            title={format(new Date(log.createdAt), 'PPpp')}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={tone}>
            <span className="inline-flex items-center gap-1">
              {icon}
              {prettyAction(log.action as string)}
            </span>
          </Badge>
          {(log.details as any)?.project ? (
            <Badge tone="neutral">{(log.details as any).project}</Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function iconForAction(action: string): {
  icon: React.ReactNode;
  tone: BadgeTone;
} {
  if (action.startsWith('TASK'))
    return { icon: <FileText className="h-3 w-3" aria-hidden="true" />, tone: 'info' };
  if (action.startsWith('CHAT'))
    return { icon: <MessageSquare className="h-3 w-3" aria-hidden="true" />, tone: 'neutral' };
  if (action.startsWith('MEMBER_REMOVED'))
    return { icon: <UserMinus className="h-3 w-3" aria-hidden="true" />, tone: 'danger' };
  if (action.startsWith('MEMBER'))
    return { icon: <UserPlus className="h-3 w-3" aria-hidden="true" />, tone: 'success' };
  if (action.startsWith('ROLE'))
    return { icon: <Shield className="h-3 w-3" aria-hidden="true" />, tone: 'warning' };
  return { icon: <Activity className="h-3 w-3" aria-hidden="true" />, tone: 'neutral' };
}

function prettyAction(a: string) {
  return a
    .split('_')
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(' ');
}

function actionMessage(action: string, details: any): string {
  switch (action) {
    case 'TASK_CREATED':
      return `created a task "${details?.title ?? 'task'}"`;
    case 'TASK_UPDATED':
      return `updated task status to ${details?.status ?? 'new status'}`;
    case 'TASK_DELETED':
      return `deleted a task`;
    case 'MEMBER_INVITED':
      return `invited ${details?.email ?? 'a teammate'} as ${details?.role ?? 'member'}`;
    case 'MEMBER_JOINED':
      return `joined the team`;
    case 'MEMBER_REMOVED':
      return `removed a team member`;
    case 'MEMBER_INVITE_REVOKED':
      return `revoked an invitation`;
    case 'MEMBER_INVITE_DECLINED':
      return `declined an invitation`;
    case 'MEMBER_ROLE_CHANGED':
      return `changed a role to ${details?.role ?? ''}`;
    case 'ROLE_UPDATED':
      return details?.action === 'Role Created'
        ? `created a role "${details?.role ?? ''}"`
        : details?.action === 'Role Deleted'
          ? `deleted a role`
          : `updated role permissions`;
    case 'CHAT_GROUP_CREATED':
      return `created a group chat`;
    case 'CHAT_MESSAGE':
      return `sent a message`;
    default:
      return `performed ${action.toLowerCase().replace(/_/g, ' ')}`;
  }
}

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
