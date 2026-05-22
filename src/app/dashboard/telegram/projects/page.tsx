'use client';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import {
    ArrowRight,
  CheckCircle2,
  Loader2,
  Plug,
  Plus,
  Search,
  } from 'lucide-react';

/**
 * Telegram project picker — scopes the global project list to the
 * Telegram view. Mirrors `/wachat` but counts connected Telegram bots
 * per project instead of filtering by `wabaId`. Selecting a project
 * sets it as active (via ProjectContext + localStorage) and then sends
 * the user back into `/dashboard/telegram/connections`.
 */

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import {
    addTelegramProject,
} from '@/app/actions/telegram.actions';
import { listTelegramBotsAction } from '@/app/actions/telegram-extra.actions';

type BotCounts = Record<string, number>;

const PAGE_SIZE = 12;

export default function TelegramProjectPickerPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const {
        projects: allProjects,
        activeProjectId,
        setActiveProjectId,
        isLoadingProject,
        reloadProjects,
    } = useProject();
    const { toast } = useZoruToast();

    const [createOpen, setCreateOpen] = React.useState(false);
    const [createName, setCreateName] = React.useState('');
    const [createBusy, setCreateBusy] = React.useState(false);
    const [createErr, setCreateErr] = React.useState<string | null>(null);

    const handleCreate = React.useCallback(async () => {
        const name = createName.trim();
        if (!name) {
            setCreateErr('Give the project a name.');
            return;
        }
        setCreateErr(null);
        setCreateBusy(true);
        const res = await addTelegramProject({ name });
        setCreateBusy(false);
        if (!res.success || !res.projectId) {
            setCreateErr(res.error ?? 'Could not create the project.');
            return;
        }
        try {
            localStorage.setItem('activeProjectId', res.projectId);
            localStorage.setItem('activeProjectName', name);
        } catch {
            /* ignore */
        }
        setActiveProjectId(res.projectId);
        await reloadProjects();
        toast({
            title: 'Project created',
            description: `“${name}” is now your active workspace.`,
        });
        setCreateOpen(false);
        setCreateName('');
        // Brand-new project has no bots yet — drop straight into the
        // Connections page so the user can paste a token.
        const explicitNext = searchParams.get('next');
        router.push(explicitNext || '/dashboard/telegram/connections');
    }, [createName, reloadProjects, router, searchParams, setActiveProjectId, toast]);

    const [counts, setCounts] = React.useState<BotCounts>({});
    const [countsLoading, setCountsLoading] = React.useState(true);
    const [q, setQ] = React.useState('');
    const [page, setPage] = React.useState(1);

    React.useEffect(() => {
        let cancelled = false;
        async function loadCounts() {
            if (allProjects.length === 0) {
                setCounts({});
                setCountsLoading(false);
                return;
            }
            setCountsLoading(true);
            // Run in parallel — each call is a thin rust round-trip.
            const entries = await Promise.all(
                allProjects.map(async (p) => {
                    const projectId = p._id.toString();
                    try {
                        const res = await listTelegramBotsAction({
                            projectId,
                            pageSize: 1,
                        });
                        return [projectId, res.total ?? res.bots?.length ?? 0] as const;
                    } catch {
                        return [projectId, 0] as const;
                    }
                }),
            );
            if (cancelled) return;
            const map: BotCounts = {};
            for (const [id, count] of entries) map[id] = count;
            setCounts(map);
            setCountsLoading(false);
        }
        void loadCounts();
        return () => {
            cancelled = true;
        };
    }, [allProjects]);

    // Telegram-only scope: exclude any project that belongs to another
    // module (Wachat by `wabaId`, Facebook by `facebookPageId`, CRM by
    // `kind: 'crm'`). Then include a project if it's tagged `kind:
    // 'telegram'` OR it already has a Telegram bot connected. While the
    // bot counts are still loading we include every otherwise-eligible
    // project so legacy workspaces (created before the `kind` flag
    // existed) still appear — once counts arrive we narrow down.
    const telegramProjects = React.useMemo(() => {
        return allProjects.filter((p: any) => {
            const isWachat = !!p.wabaId;
            const isFacebook = !!p.facebookPageId;
            const isCrm = p.kind === 'crm';
            const isSabwa = p.kind === 'sabwa';
            if (isWachat || isFacebook || isCrm || isSabwa) return false;
            const isExplicitTelegram = p.kind === 'telegram';
            const hasBot = (counts[p._id.toString()] ?? 0) > 0;
            if (countsLoading) return true;
            return isExplicitTelegram || hasBot;
        });
    }, [allProjects, counts, countsLoading]);

    const filtered = React.useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return telegramProjects;
        return telegramProjects.filter((p) =>
            p.name?.toLowerCase().includes(needle),
        );
    }, [telegramProjects, q]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = React.useMemo(
        () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filtered, page],
    );

    const selectProject = React.useCallback(
        (projectId: string, projectName: string) => {
            setActiveProjectId(projectId);
            try {
                localStorage.setItem('activeProjectId', projectId);
                localStorage.setItem('activeProjectName', projectName);
            } catch {
                /* ignore */
            }
            // If the caller asked for a specific next page, honour it.
            // Otherwise: workspaces with no bots yet land on Connections
            // so the next step is obvious; workspaces with bots land on
            // the overview where stats are immediately useful.
            const explicitNext = searchParams.get('next');
            if (explicitNext) {
                router.push(explicitNext);
                return;
            }
            const hasBot = (counts[projectId] ?? 0) > 0;
            router.push(
                hasBot
                    ? '/dashboard/telegram'
                    : '/dashboard/telegram/connections',
            );
        },
        [counts, router, searchParams, setActiveProjectId],
    );

    if (isLoadingProject) {
        return (
            <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <ZoruSkeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background:
                            'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                        boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
                    }}
                >
                    <Plug className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                    <h1 className="text-[22px] leading-tight text-zoru-ink">
                        Pick a Telegram workspace
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Telegram bots, chats, and broadcasts belong to a project.
                        Choose one to start in — projects with a green badge already
                        have at least one bot connected.
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
                    <ZoruInput
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search projects by name"
                        className="pl-9"
                    />
                </div>
                <ZoruButton
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setCreateErr(null);
                        setCreateName('');
                        setCreateOpen(true);
                    }}
                >
                    <Plus className="h-3 w-3" />
                    New Telegram project
                </ZoruButton>
            </div>

            {filtered.length === 0 ? (
                <ZoruEmptyState
                    title={
                        allProjects.length === 0
                            ? 'No projects yet'
                            : 'No matching projects'
                    }
                    description={
                        allProjects.length === 0
                            ? 'Create your first Telegram workspace to connect bots, build flows, and run broadcasts.'
                            : 'Try a different search term or clear the filter.'
                    }
                    action={
                        allProjects.length === 0 ? (
                            <ZoruButton
                                size="sm"
                                onClick={() => {
                                    setCreateErr(null);
                                    setCreateName('');
                                    setCreateOpen(true);
                                }}
                            >
                                <Plus className="h-3 w-3" />
                                Create Telegram project
                            </ZoruButton>
                        ) : undefined
                    }
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {paged.map((p) => {
                        const id = p._id.toString();
                        const isActive = activeProjectId === id;
                        const botCount = counts[id] ?? 0;
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() => selectProject(id, p.name)}
                                    className="w-full text-left"
                                >
                                    <ZoruCard className="flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-md">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                                                style={{
                                                    background:
                                                        'linear-gradient(135deg, #E0F4FF 0%, #B9E4FA 100%)',
                                                }}
                                            >
                                                <Plug
                                                    className="h-4 w-4"
                                                    strokeWidth={1.75}
                                                    style={{ color: '#007DBB' }}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-[13.5px] text-zoru-ink">
                                                        {p.name}
                                                    </p>
                                                    {isActive ? (
                                                        <ZoruBadge variant="info">
                                                            Active
                                                        </ZoruBadge>
                                                    ) : null}
                                                </div>
                                                <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                                    {countsLoading
                                                        ? 'Counting bots…'
                                                        : botCount === 0
                                                        ? 'No Telegram bots yet'
                                                        : `${botCount} bot${botCount === 1 ? '' : 's'} connected`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {botCount > 0 ? (
                                                <ZoruBadge variant="success">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Telegram
                                                </ZoruBadge>
                                            ) : (
                                                <ZoruBadge variant="ghost">
                                                    Not set up
                                                </ZoruBadge>
                                            )}
                                            <ArrowRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        </div>
                                    </ZoruCard>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-between text-[12px] text-zoru-ink-muted">
                    <span>
                        Page {page} of {totalPages} · {filtered.length} project
                        {filtered.length === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-2">
                        <ZoruButton
                            size="sm"
                            variant="outline"
                            onClick={() => setPage((n) => Math.max(1, n - 1))}
                            disabled={page === 1}
                        >
                            Previous
                        </ZoruButton>
                        <ZoruButton
                            size="sm"
                            variant="outline"
                            onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                            disabled={page === totalPages}
                        >
                            Next
                        </ZoruButton>
                    </div>
                </div>
            ) : null}

            <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
                <ZoruDialogContent className="max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>New Telegram project</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            A Telegram project is a workspace for bots, chats,
                            and broadcasts. It's separate from your WhatsApp
                            (Wachat) projects — only data and rules created
                            inside this project apply to its bots.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>

                    <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                                Project name
                            </span>
                            <ZoruInput
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                placeholder="e.g. Support bot — EU"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !createBusy) {
                                        e.preventDefault();
                                        void handleCreate();
                                    }
                                }}
                            />
                        </label>
                        {createErr ? (
                            <div className="rounded-md border border-zoru-danger-line bg-zoru-danger-surface px-3 py-2 text-[12.5px] text-zoru-danger-ink">
                                {createErr}
                            </div>
                        ) : null}
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={() => setCreateOpen(false)}
                            disabled={createBusy}
                        >
                            Cancel
                        </ZoruButton>
                        <ZoruButton
                            size="sm"
                            onClick={() => void handleCreate()}
                            disabled={createBusy || !createName.trim()}
                        >
                            {createBusy ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Plus className="h-3 w-3" />
                            )}
                            Create project
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
