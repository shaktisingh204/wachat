'use client';

import * as React from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
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
  useToast,
} from '@/components/sabcrm/20ui';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Plug,
  Plus,
  RefreshCw,
  Search,
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
    const select = () => onSelect(id, project.name);
    return (
        <li>
            <Card
                variant="interactive"
                role="button"
                tabIndex={0}
                aria-label={`Open ${project.name}`}
                onClick={select}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        select();
                    }
                }}
                className="flex cursor-pointer items-center justify-between gap-3 p-4"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-bg-muted)]">
                        <Plug
                            className="h-4 w-4 text-[var(--st-text)]"
                            strokeWidth={1.75}
                            aria-hidden="true"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-[13.5px] text-[var(--st-text)]">
                                {project.name}
                            </p>
                            {isActive ? (
                                <Badge variant="info">Active</Badge>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                            {countsLoading
                                ? 'Counting bots...'
                                : botCount === 0
                                ? 'No Telegram bots yet'
                                : `${botCount} bot${botCount === 1 ? '' : 's'} connected`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {botCount > 0 ? (
                        <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            Telegram
                        </Badge>
                    ) : (
                        <Badge tone="neutral">Not set up</Badge>
                    )}
                    <ArrowRight
                        className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                    />
                </div>
            </Card>
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>New Telegram project</DialogTitle>
                    <DialogDescription>
                        A Telegram project is a workspace for bots, chats,
                        and broadcasts. It is separate from your WhatsApp
                        (Wachat) projects. Only data and rules created
                        inside this project apply to its bots.
                    </DialogDescription>
                </DialogHeader>

                <Field label="Project name" error={createErr ?? undefined}>
                    <Input
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="e.g. Support bot, EU"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !createBusy) {
                                e.preventDefault();
                                void handleCreate();
                            }
                        }}
                    />
                </Field>

                <DialogFooter>
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
                        variant="primary"
                        iconLeft={Plus}
                        loading={createBusy}
                        onClick={() => void handleCreate()}
                        disabled={createBusy || !createName.trim()}
                    >
                        Create project
                    </Button>
                </DialogFooter>
            </DialogContent>
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
    const { toast } = useToast();

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
            description: `"${name}" is now your active workspace.`,
            tone: 'success',
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
            <PageHeader bordered={false} className="items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37BBFE] to-[#007DBB] shadow-[0_10px_28px_rgba(0,125,187,0.25)]">
                    <Plug className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <PageHeaderHeading>
                    <PageTitle>Pick a Telegram workspace</PageTitle>
                    <PageDescription>
                        Telegram bots, chats, and broadcasts belong to a project.
                        Choose one to start in. Projects with a green badge already
                        have at least one bot connected.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {countsError && !countsLoading ? (
                <Alert variant="warning" className="py-3">
                    <div className="flex items-center justify-between gap-4">
                        <AlertDescription>{countsError}</AlertDescription>
                        <Button
                            variant="outline"
                            size="sm"
                            iconLeft={RefreshCw}
                            onClick={() => void loadCounts(false)}
                        >
                            Retry
                        </Button>
                    </div>
                </Alert>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <div className="w-full sm:max-w-md">
                        <Input
                            iconLeft={Search}
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search projects by name"
                            aria-label="Search projects by name"
                        />
                    </div>
                    <Select value={sortBy} onValueChange={(val: SortOption) => { setSortBy(val); setPage(1); }}>
                        <SelectTrigger className="w-[160px]" aria-label="Sort projects">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                            <SelectItem value="bots-desc">Bots connected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    iconLeft={Plus}
                    onClick={() => {
                        setCreateOpen(true);
                    }}
                >
                    New Telegram project
                </Button>
            </div>

            {filteredAndSorted.length === 0 ? (
                <EmptyState
                    icon={Plug}
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
                                variant="primary"
                                iconLeft={Plus}
                                onClick={() => {
                                    setCreateOpen(true);
                                }}
                            >
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
                <div className="flex items-center justify-between text-[12px] text-[var(--st-text-secondary)]">
                    <span>
                        Page {page} of {totalPages} . {filteredAndSorted.length} project
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
