'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  type ZoruBadgeProps,
} from '@/components/sabcrm/20ui/compat';
import {
  format,
  formatDistanceToNow } from 'date-fns';
import {
    Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Loader,
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

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/team/manage-users">Team</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Activity</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Activity</ZoruPageTitle>
                    <ZoruPageDescription>
                        Every invite, role change, task move, and chat event — chronologically.
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </PageHeader>

            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-[180px]">
                        <Select
                            value={actor}
                            onValueChange={(v) => {
                                setActor(v);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All actors</ZoruSelectItem>
                                {members.map((m) => (
                                    <ZoruSelectItem key={m._id.toString()} value={m._id.toString()}>
                                        {m.name || m.email}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="w-[180px]">
                        <Select
                            value={group}
                            onValueChange={(v) => {
                                setGroup(v as ActionGroup);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All events</ZoruSelectItem>
                                <ZoruSelectItem value="TASK">Tasks</ZoruSelectItem>
                                <ZoruSelectItem value="MEMBER">Members</ZoruSelectItem>
                                <ZoruSelectItem value="ROLE">Roles</ZoruSelectItem>
                                <ZoruSelectItem value="CHAT">Chat</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <Input
                        className="w-[160px]"
                        type="date"
                        value={since}
                        onChange={(e) => {
                            setSince(e.target.value);
                            setPage(1);
                        }}
                    />
                    <Input
                        className="w-[160px]"
                        type="date"
                        value={until}
                        onChange={(e) => {
                            setUntil(e.target.value);
                            setPage(1);
                        }}
                    />
                    {(actor !== 'all' || group !== 'all' || since || until) && (
                        <button
                            type="button"
                            onClick={() => {
                                setActor('all');
                                setGroup('all');
                                setSince('');
                                setUntil('');
                                setPage(1);
                            }}
                            className="text-[12px] text-zoru-ink underline-offset-2 hover:underline"
                        >
                            Reset
                        </button>
                    )}
                </div>
                <div className="text-[12px] text-zoru-ink-muted">
                    {total.toLocaleString()} event{total === 1 ? '' : 's'}
                </div>
            </Card>

            <Card className="overflow-hidden p-0">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 p-10 text-zoru-ink-muted">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span className="text-[13px]">Loading activity…</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-12 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                            <Activity className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <div className="text-[15px] text-zoru-ink">No matching activity</div>
                        <div className="max-w-[360px] text-[12.5px] text-zoru-ink-muted">
                            Try broadening the filters — as your team does more, this feed fills up.
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-zoru-line">
                        {logs.map((log) => (
                            <ActivityRow key={log._id.toString()} log={log} />
                        ))}
                    </div>
                )}
            </Card>

            {totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                    </Button>
                    <span className="text-[12px] text-zoru-ink-muted">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

/* ─────────────────────────────────── ROW ────────────────────────────────────── */

function ActivityRow({ log }: { log: WithId<ActivityLog> }) {
    const { icon, variant } = iconForAction(log.action as string);
    const label = (log.user?.name || log.user?.email || 'Unknown').charAt(0).toUpperCase();
    return (
        <div className="flex items-start gap-3 px-5 py-4">
            <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px]"
                style={{
                    background: `hsl(${hashHue(log.user?.email || 'x')} 60% 90%)`,
                    color: `hsl(${hashHue(log.user?.email || 'x')} 45% 28%)`,
                }}
            >
                {label || '?'}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-4">
                    <div className="text-[13px]">
                        <span className="text-zoru-ink">{log.user?.name || 'Unknown user'}</span>{' '}
                        <span className="text-zoru-ink-muted">{actionMessage(log.action as string, log.details)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-[11px] text-zoru-ink-muted" title={format(new Date(log.createdAt), 'PPpp')}>
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={variant}>
                        <span className="inline-flex items-center gap-1">
                            {icon}
                            {prettyAction(log.action as string)}
                        </span>
                    </Badge>
                    {(log.details as any)?.project ? (
                        <Badge variant="ghost">{(log.details as any).project}</Badge>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function iconForAction(action: string): {
    icon: React.ReactNode;
    variant: NonNullable<ZoruBadgeProps['variant']>;
} {
    if (action.startsWith('TASK')) return { icon: <FileText className="h-3 w-3" />, variant: 'info' };
    if (action.startsWith('CHAT')) return { icon: <MessageSquare className="h-3 w-3" />, variant: 'secondary' };
    if (action.startsWith('MEMBER_REMOVED'))
        return { icon: <UserMinus className="h-3 w-3" />, variant: 'danger' };
    if (action.startsWith('MEMBER')) return { icon: <UserPlus className="h-3 w-3" />, variant: 'success' };
    if (action.startsWith('ROLE')) return { icon: <Shield className="h-3 w-3" />, variant: 'warning' };
    return { icon: <Activity className="h-3 w-3" />, variant: 'ghost' };
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
