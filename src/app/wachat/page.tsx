'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    RefreshCw,
    Search as SearchIcon,
    ArrowRight,
    MessageSquare,
    Sparkles,
} from 'lucide-react';
import { useProject } from '@/context/project-context';
import { getWabaHealthStatus } from '@/app/actions/whatsapp.actions';
import { SyncProjectsDialog } from '@/app/wachat/_components/sync-projects-dialog';
import {
    WaPage,
    PageHeader,
    WaButton,
    ProjectTile,
    EmptyState,
} from '@/components/wachat-ui';
import { m } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const PAGE_SIZE = 24;

type HealthFlag = 'live' | 'warning' | 'paused' | 'unconnected';

/**
 * Map the WABA `can_send_message` flag + project state into our 4-state
 * health value. Conservative: anything we can't classify as fine becomes
 * a soft warning rather than a hard red.
 */
function deriveHealth(args: { hasWaba: boolean; hasPhone: boolean; canSend?: string }): HealthFlag {
    if (!args.hasWaba) return 'unconnected';
    if (!args.hasPhone) return 'paused';
    const v = (args.canSend ?? '').toUpperCase();
    if (v === 'AVAILABLE' || v === 'CAN_SEND_MESSAGE' || v === 'GREEN' || v === 'OK') return 'live';
    if (v === 'BLOCKED' || v === 'RED' || v === 'BANNED') return 'warning';
    if (v === 'YELLOW' || v === 'LIMITED' || v === 'RATE_LIMITED') return 'warning';
    if (!v) return 'live'; // assume live until health check returns
    return 'warning';
}

export default function WachatProjectsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { projects, reloadProjects, isLoadingProject, setActiveProjectId } = useProject();

    const [, startHealthTransition] = useTransition();
    const [search, setSearch] = useState(searchParams.get('query') || '');
    const [page, setPage] = useState(1);
    const [healthMap, setHealthMap] = useState<Record<string, string>>({});
    const [recentIds, setRecentIds] = useState<string[]>([]);

    // Restore recent-project list from localStorage on mount.
    useEffect(() => {
        try {
            const raw = localStorage.getItem('recentProjects');
            if (raw) setRecentIds(JSON.parse(raw));
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        document.title = 'Projects · Wachat';
    }, []);

    // Pull live health for each WABA in the background. Failures are silent;
    // we just leave the dot grey and let the user discover issues on entry.
    useEffect(() => {
        if (projects.length === 0) return;
        startHealthTransition(async () => {
            const results: Record<string, string> = {};
            await Promise.allSettled(
                projects.map(async (p) => {
                    if (!p.wabaId) return;
                    try {
                        const { healthStatus } = await getWabaHealthStatus(p._id.toString());
                        if (healthStatus?.can_send_message) {
                            results[p._id.toString()] = healthStatus.can_send_message;
                        }
                    } catch {
                        /* ignore */
                    }
                }),
            );
            setHealthMap(results);
        });
    }, [projects]);

    const recentProjects = useMemo(
        () => projects.filter((p) => recentIds.includes(p._id.toString())).slice(0, 4),
        [projects, recentIds],
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return projects;
        const q = search.toLowerCase();
        return projects.filter(
            (p) =>
                p.name?.toLowerCase().includes(q) ||
                p.wabaId?.toLowerCase().includes(q) ||
                p.phoneNumbers?.[0]?.display_phone_number?.toLowerCase().includes(q),
        );
    }, [projects, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = useMemo(
        () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filtered, page],
    );

    // Counts for the metric strip — derived from the projects we already
    // have, no extra fetch.
    const counts = useMemo(() => {
        let connected = 0;
        let pending = 0;
        let numbers = 0;
        for (const p of projects) {
            if (p.wabaId && (p.phoneNumbers?.length ?? 0) > 0) connected += 1;
            else pending += 1;
            numbers += p.phoneNumbers?.length ?? 0;
        }
        return { connected, pending, numbers };
    }, [projects]);

    const handleSelect = (projectId: string) => {
        const project = projects.find((p) => p._id.toString() === projectId);
        if (!project) return;

        if (!project.wabaId) {
            setActiveProjectId(projectId);
            router.push('/wachat/setup');
            return;
        }
        if (!project.phoneNumbers || project.phoneNumbers.length === 0) {
            setActiveProjectId(projectId);
            router.push('/wachat/numbers');
            return;
        }

        const updated = [projectId, ...recentIds.filter((id) => id !== projectId)].slice(0, 8);
        try {
            localStorage.setItem('recentProjects', JSON.stringify(updated));
        } catch {
            /* ignore */
        }
        setActiveProjectId(projectId);
        router.push('/wachat/overview');
    };

    const showRecent = recentProjects.length > 0 && !search.trim();

    return (
        <WaPage>
            <PageHeader
                title="Your WhatsApp projects"
                description="Pick a connected WABA to open its inbox, campaigns, templates, and reports."
                kicker="Wachat · projects"
                actions={
                    <>
                        <SyncProjectsDialog onSuccess={reloadProjects} />
                        <WaButton href="/wachat/setup" leftIcon={Plus}>
                            Connect new
                        </WaButton>
                    </>
                }
            />

            {/* Metric strip — quick at-a-glance counts */}
            <section aria-labelledby="counts-heading" className="mb-8 grid grid-cols-3 gap-3">
                <h2 id="counts-heading" className="sr-only">Account counts</h2>
                <CountChip label="Connected" value={counts.connected} accentSoft={false} />
                <CountChip label="Pending setup" value={counts.pending} accentSoft={true} />
                <CountChip label="Phone numbers" value={counts.numbers} accentSoft={false} />
            </section>

            {/* Search */}
            {projects.length > 0 && (
                <m.label
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="mb-6 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400 sm:max-w-md"
                >
                    <SearchIcon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
                    <input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search by name, number, or WABA ID"
                        className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                        aria-label="Search projects"
                    />
                </m.label>
            )}

            {/* Recently accessed */}
            {showRecent && (
                <section className="mb-10">
                    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Recently accessed
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {recentProjects.map((p, i) => {
                            const id = p._id.toString();
                            return (
                                <ProjectTile
                                    key={id}
                                    name={p.name ?? 'Untitled project'}
                                    phone={p.phoneNumbers?.[0]?.display_phone_number}
                                    waba={p.wabaId}
                                    recent
                                    health={deriveHealth({
                                        hasWaba: !!p.wabaId,
                                        hasPhone: (p.phoneNumbers?.length ?? 0) > 0,
                                        canSend: healthMap[id],
                                    })}
                                    onSelect={() => handleSelect(id)}
                                    delay={0.03 + i * 0.04}
                                />
                            );
                        })}
                    </div>
                </section>
            )}

            {/* All projects */}
            <section>
                <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        {showRecent && projects.length > recentProjects.length ? 'All projects' : 'Projects'}
                    </h2>
                    <span className="text-[11px] tabular-nums text-zinc-400">
                        {filtered.length.toLocaleString('en-IN')} {filtered.length === 1 ? 'project' : 'projects'}
                    </span>
                </div>

                {isLoadingProject ? (
                    <GridSkeleton />
                ) : projects.length === 0 ? (
                    <EmptyState
                        icon={MessageSquare}
                        title="No projects connected yet"
                        description="Connect your WhatsApp Business Account to start sending templates, broadcasts, and chatbots from SabNode."
                        action={
                            <WaButton href="/wachat/setup" leftIcon={Sparkles}>
                                Connect your first WABA
                            </WaButton>
                        }
                    />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={SearchIcon}
                        title={`No projects match “${search}”`}
                        description="Try a different name, phone number, or WABA ID."
                        action={
                            <WaButton variant="outline" onClick={() => { setSearch(''); setPage(1); }} leftIcon={RefreshCw}>
                                Clear search
                            </WaButton>
                        }
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {paginated.map((p, i) => {
                            const id = p._id.toString();
                            return (
                                <li key={id}>
                                    <ProjectTile
                                        name={p.name ?? 'Untitled project'}
                                        phone={p.phoneNumbers?.[0]?.display_phone_number}
                                        waba={p.wabaId}
                                        health={deriveHealth({
                                            hasWaba: !!p.wabaId,
                                            hasPhone: (p.phoneNumbers?.length ?? 0) > 0,
                                            canSend: healthMap[id],
                                        })}
                                        onSelect={() => handleSelect(id)}
                                        delay={0.03 + i * 0.03}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* Pagination */}
            {totalPages > 1 && (
                <nav
                    aria-label="Pagination"
                    className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5"
                >
                    <p className="text-[12px] tabular-nums text-zinc-500">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1.5">
                        <WaButton
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            leftIcon={ChevronLeft}
                        >
                            Previous
                        </WaButton>
                        <WaButton
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            rightIcon={ChevronRight}
                        >
                            Next
                        </WaButton>
                    </div>
                </nav>
            )}
        </WaPage>
    );
}

// ────────── small chip used for the top counters ──────────
function CountChip({ label, value, accentSoft }: { label: string; value: number; accentSoft: boolean }) {
    return (
        <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white px-5 py-4"
        >
            <span
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl"
                style={{ background: accentSoft ? 'rgba(251, 191, 36, 0.25)' : 'var(--mt-accent-glow)', opacity: 0.6 }}
            />
            <p className="relative text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
            <p className="relative mt-1.5 text-[26px] font-semibold tracking-tight text-zinc-950 tabular-nums">
                {value.toLocaleString('en-IN')}
            </p>
        </m.div>
    );
}

// ────────── grid skeleton ──────────
function GridSkeleton() {
    return (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="h-[164px] animate-pulse rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="h-11 w-11 rounded-xl bg-zinc-100" />
                    <div className="mt-4 h-3 w-32 rounded-full bg-zinc-100" />
                    <div className="mt-2 h-2.5 w-24 rounded-full bg-zinc-100" />
                    <div className="mt-2 h-2.5 w-28 rounded-full bg-zinc-100" />
                    <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-3">
                        <div className="h-4 w-16 rounded-full bg-zinc-100" />
                        <div className="h-3 w-10 rounded-full bg-zinc-100" />
                    </div>
                </li>
            ))}
        </ul>
    );
}
