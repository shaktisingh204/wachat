'use client';

import * as React from 'react';
import Link from 'next/link';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  ZoruAlertDescription,
} from '@/components/zoruui';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plug,
  Plus,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { addTelegramProject } from '@/app/actions/telegram.actions';
import { listTelegramBotsAction } from '@/app/actions/telegram-extra.actions';
import type { Project } from '@/lib/definitions';

type ProjectWithId = Project & { _id: { toString: () => string } | string };
type BotCounts = Record<string, number>;
type SortOption = 'name-asc' | 'name-desc' | 'bots-desc';

const PAGE_SIZE = 12;

// --- Sub-components ---

function ProjectCard({
    project,
    botCount,
    countsLoading,
    isActive,
    onSelect,
}: {
    project: ProjectWithId;
    botCount: number;
    countsLoading: boolean;
    isActive: boolean;
    onSelect: (id: string, name: string) => void;
}) {
    const id = project._id.toString();
    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(id, project.name)}
                className="w-full text-left"
            >
                <Card className="flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-md">
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
                                    {project.name}
                                </p>
                                {isActive ? (
                                    <Badge variant="info">Active</Badge>
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
                            <Badge variant="success">
                                <CheckCircle2 className="h-3 w-3" />
                                Telegram
                            </Badge>
                        ) : (
                            <Badge variant="ghost">Not set up</Badge>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                    </div>
                </Card>
            </button>
        </li>
    );
}

function CreateTelegramProjectDialog({
    open,
    onOpenChange,
    onCreate,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (name: string) => Promise<void>;
}) {
    const [createName, setCreateName] = React.useState('');
    const [createBusy, setCreateBusy] = React.useState(false);
    const [createErr, setCreateErr] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (open) {
            setCreateName('');
            setCreateErr(null);
            setCreateBusy(false);
        }
    }, [open]);

    const handleCreate = async () => {
        const name = createName.trim();
        if (!name) {
            setCreateErr('Give the project a name.');
            return;
        }
        setCreateBusy(true);
        setCreateErr(null);
        try {
            await onCreate(name);
        } catch (err: any) {
            setCreateErr(err.message || 'Could not create the project.');
        } finally {
            setCreateBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                        <Input
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={createBusy}
                    >
                        Cancel
                    </Button>
                    <Button
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
                    </Button>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

function ProjectsSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2 mt-1">
                    <Skeleton className="h-6 w-64" />
                    <Skeleton className="h-4 w-full max-w-2xl" />
                    <Skeleton className="h-4 w-3/4 max-w-xl" />
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                 <Skeleton className="h-9 w-full sm:max-w-md" />
                 <Skeleton className="h-9 w-40" />
            </div>
            <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

// --- Main Page ---

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

    const handleCreateProject = React.useCallback(async (name: string) => {
        const res = await addTelegramProject({ name });
        if (!res.success || !res.projectId) {
            throw new Error(res.error ?? 'Could not create the project.');
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
        const explicitNext = searchParams.get('next');
        router.push(explicitNext || '/dashboard/telegram/connections');
    }, [reloadProjects, router, searchParams, setActiveProjectId, toast]);

    const [counts, setCounts] = React.useState<BotCounts>({});
    const [countsLoading, setCountsLoading] = React.useState(true);
    const [countsError, setCountsError] = React.useState<string | null>(null);

    const [q, setQ] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [sortBy, setSortBy] = React.useState<SortOption>('name-asc');

    const loadCounts = React.useCallback(async (silent = false) => {
        if (allProjects.length === 0) {
            setCounts({});
            if (!silent) setCountsLoading(false);
            return;
        }
        if (!silent) {
            setCountsLoading(true);
            setCountsError(null);
        }
        try {
            const entries = await Promise.all(
                allProjects.map(async (p: any) => {
                    const projectId = p._id.toString();
                    try {
                        const res = await listTelegramBotsAction({
                            projectId,
                            pageSize: 1,
                        });
                        return [projectId, res.total ?? res.bots?.length ?? 0] as const;
                    } catch (e) {
                        return [projectId, -1] as const;
                    }
                }),
            );
            
            setCounts(prev => {
                const map: BotCounts = { ...prev };
                let hasError = false;
                for (const [id, count] of entries) {
                    if (count === -1) {
                        hasError = true;
                    } else {
                        map[id] = count;
                    }
                }
                if (hasError && !silent) {
                    setCountsError('Some project bots failed to load.');
                }
                return map;
            });
        } catch (e) {
            if (!silent) setCountsError('Failed to load bot counts.');
        } finally {
            if (!silent) setCountsLoading(false);
        }
    }, [allProjects]);

    React.useEffect(() => {
        let cancelled = false;

        const load = async () => {
            await loadCounts();
            if (cancelled) return;
        };

        void load();

        const intervalId = setInterval(() => {
            if (!cancelled) {
                void loadCounts(true);
            }
        }, 15000);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [loadCounts]);

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

    const filteredAndSorted = React.useMemo(() => {
        const needle = q.trim().toLowerCase();
        let result = telegramProjects;

        if (needle) {
            result = result.filter((p: any) =>
                p.name?.toLowerCase().includes(needle),
            );
        }

        return [...result].sort((a: any, b: any) => {
            const nameA = a.name?.toLowerCase() || '';
            const nameB = b.name?.toLowerCase() || '';
            
            if (sortBy === 'name-asc') {
                return nameA.localeCompare(nameB);
            }
            if (sortBy === 'name-desc') {
                return nameB.localeCompare(nameA);
            }
            if (sortBy === 'bots-desc') {
                const countA = counts[a._id.toString()] ?? 0;
                const countB = counts[b._id.toString()] ?? 0;
                if (countA !== countB) {
                     return countB - countA;
                }
                return nameA.localeCompare(nameB);
            }
            return 0;
        });
    }, [telegramProjects, q, sortBy, counts]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
    const paged = React.useMemo(
        () => filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filteredAndSorted, page],
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
        return <ProjectsSkeleton />;
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
            
            {countsError && !countsLoading ? (
                <Alert variant="warning" className="py-3">
                    <AlertCircle className="h-4 w-4" />
                    <div className="flex items-center justify-between gap-4">
                        <ZoruAlertDescription>{countsError}</ZoruAlertDescription>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 px-2 text-[11px]"
                            onClick={() => void loadCounts(false)}
                        >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Retry
                        </Button>
                    </div>
                </Alert>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
                        <Input
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search projects by name"
                            className="pl-9"
                        />
                    </div>
                    <Select value={sortBy} onValueChange={(val: SortOption) => { setSortBy(val); setPage(1); }}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                            <SelectItem value="bots-desc">Bots Connected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setCreateOpen(true);
                    }}
                >
                    <Plus className="h-3 w-3" />
                    New Telegram project
                </Button>
            </div>

            {filteredAndSorted.length === 0 ? (
                <EmptyState
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
                            <Button
                                size="sm"
                                onClick={() => {
                                    setCreateOpen(true);
                                }}
                            >
                                <Plus className="h-3 w-3" />
                                Create Telegram project
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {paged.map((p: any) => (
                        <ProjectCard
                            key={p._id.toString()}
                            project={p}
                            botCount={counts[p._id.toString()] ?? 0}
                            countsLoading={countsLoading}
                            isActive={activeProjectId === p._id.toString()}
                            onSelect={selectProject}
                        />
                    ))}
                </ul>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-between text-[12px] text-zoru-ink-muted">
                    <span>
                        Page {page} of {totalPages} · {filteredAndSorted.length} project
                        {filteredAndSorted.length === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPage((n) => Math.max(1, n - 1))}
                            disabled={page === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                            disabled={page === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            ) : null}

            <CreateTelegramProjectDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreate={handleCreateProject}
            />
        </div>
    );
}
