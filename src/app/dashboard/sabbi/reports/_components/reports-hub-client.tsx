'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    ChevronDown,
    Search,
    Star,
    FileBarChart,
    Wallet,
    Receipt,
    TrendingUp,
    Calculator,
    Clock4,
    CreditCard,
    Target,
    ArrowRightLeft,
    Crown,
    Package,
    FolderKanban,
    ListChecks,
    AlertTriangle,
    CalendarDays,
    PlaneTakeoff,
    Timer,
    Scale,
    Cake,
    Ticket,
    UserCog,
    Banknote,
    Briefcase,
    Users,
    LifeBuoy,
    ScrollText,
} from 'lucide-react';

import { Card, Input, Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/sabcrm/20ui';

/**
 * Server → client boundary is serialization-only: icons are passed as
 * string names (not component functions, which are non-serializable and
 * would crash the server render). Resolve names to components here.
 */
const ICON_MAP: Record<string, React.ElementType> = {
    FileBarChart,
    Wallet,
    Receipt,
    TrendingUp,
    Calculator,
    Clock4,
    CreditCard,
    Target,
    ArrowRightLeft,
    Crown,
    Package,
    FolderKanban,
    ListChecks,
    AlertTriangle,
    CalendarDays,
    PlaneTakeoff,
    Timer,
    Scale,
    Cake,
    Ticket,
    UserCog,
    Banknote,
    Briefcase,
    Users,
    LifeBuoy,
    ScrollText,
    Star,
};

function resolveIcon(name?: string | null): React.ElementType {
    return (name && ICON_MAP[name]) || FileBarChart;
}

export interface ReportLink {
    href: string;
    label: string;
    description: string;
    iconName: string;
}

export interface ReportCategory {
    id: string;
    title: string;
    iconName: string;
    items: ReportLink[];
    lastRefreshAt?: string | null;
    runs?: number;
}

export interface RecentRunRow {
    runId: string;
    definitionId: string;
    kind: string;
    name: string;
    status: string;
    rowCount: number;
    startedAt: string;
}

function fmtRel(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 'Unknown';
    const diff = Date.now() - t;
    const min = Math.round(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
}

const statusTone: Record<string, 'success' | 'default' | 'destructive' | 'outline'> = {
    succeeded: 'success',
    failed: 'destructive',
    running: 'outline',
};

export function ReportsHubClient({
    categories,
    recentRuns,
}: {
    categories: ReportCategory[];
    recentRuns: RecentRunRow[];
}): React.JSX.Element {
    const [query, setQuery] = React.useState('');
    const [activeCategory, setActiveCategory] = React.useState<string | 'all'>('all');
    const [openMap, setOpenMap] = React.useState<Record<string, boolean>>(() => {
        const init: Record<string, boolean> = {};
        for (const c of categories) init[c.id] = true;
        return init;
    });

    const [favorites, setFavorites] = React.useState<string[]>([]);
    
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem('crm_favorite_reports');
            if (stored) setFavorites(JSON.parse(stored));
        } catch {}
    }, []);

    const toggleFavorite = React.useCallback((e: React.MouseEvent, href: string) => {
        e.preventDefault();
        e.stopPropagation();
        setFavorites((prev) => {
            const next = prev.includes(href) ? prev.filter(x => x !== href) : [...prev, href];
            try { localStorage.setItem('crm_favorite_reports', JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);

    const normalised = query.trim().toLowerCase();

    const displayCategories = React.useMemo(() => {
        let cats = [...categories];
        
        if (favorites.length > 0) {
            const favItems: ReportLink[] = [];
            for (const c of categories) {
                for (const it of c.items) {
                    if (favorites.includes(it.href)) favItems.push(it);
                }
            }
            if (favItems.length > 0) {
                cats = [
                    { id: 'favorites', title: 'Favorites', iconName: 'Star', items: favItems, lastRefreshAt: null, runs: 0 },
                    ...cats
                ];
            }
        }
        return cats;
    }, [categories, favorites]);

    const filteredCategories = React.useMemo(() => {
        return displayCategories
            .filter((cat) => activeCategory === 'all' || cat.id === activeCategory)
            .map((cat) => ({
                ...cat,
                items: cat.items.filter((it) => {
                    if (!normalised) return true;
                    return (
                        it.label.toLowerCase().includes(normalised) ||
                        it.description.toLowerCase().includes(normalised)
                    );
                }),
            }))
            .filter((cat) => cat.items.length > 0);
    }, [displayCategories, activeCategory, normalised]);

    const toggleCategory = (id: string) => {
        setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Search + category filter */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="md:max-w-md md:flex-1">
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search reports..."
                        leadingSlot={<Search aria-hidden="true" />}
                        aria-label="Search reports"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <CategoryChip
                        active={activeCategory === 'all'}
                        onClick={() => setActiveCategory('all')}
                        label="All"
                    />
                    {displayCategories.map((cat) => (
                        <CategoryChip
                            key={cat.id}
                            active={activeCategory === cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            label={cat.title}
                        />
                    ))}
                </div>
            </div>

            {/* Category KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                {displayCategories.map((cat) => {
                    const Icon = resolveIcon(cat.iconName);
                    return (
                        <Card key={cat.id} className="p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                </div>
                                <span className="text-[11px] text-[var(--st-text-tertiary)]">
                                    {cat.items.length} reports
                                </span>
                            </div>
                            <p className="mt-3 truncate text-[13px] font-medium text-[var(--st-text)]">
                                {cat.title}
                            </p>
                            <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                Last run {fmtRel(cat.lastRefreshAt)}
                            </p>
                        </Card>
                    );
                })}
            </div>

            {/* Recent runs + report sections */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {filteredCategories.length === 0 ? (
                        <Card className="flex min-h-[160px] items-center justify-center p-6">
                            <p className="text-[13px] text-[var(--st-text-secondary)]">
                                No reports match your search.
                            </p>
                        </Card>
                    ) : null}
                    {filteredCategories.map((cat) => {
                        const Icon = resolveIcon(cat.iconName);
                        const open = openMap[cat.id] ?? true;
                        return (
                            <section key={cat.id}>
                                <Collapsible open={open} onOpenChange={() => toggleCategory(cat.id)}>
                                    <div className="flex items-center justify-between">
                                        <CollapsibleTrigger asChild>
                                            <button
                                                type="button"
                                                className="group flex items-center gap-2 text-left"
                                                aria-label={`Toggle ${cat.title}`}
                                            >
                                                <Icon
                                                    className="h-4 w-4 text-[var(--st-text-secondary)]"
                                                    strokeWidth={1.75}
                                                    aria-hidden="true"
                                                />
                                                <h2 className="text-[15px] font-semibold text-[var(--st-text)]">
                                                    {cat.title}
                                                </h2>
                                                <span className="text-[11.5px] text-[var(--st-text-tertiary)]">
                                                    {cat.items.length}
                                                </span>
                                                <ChevronDown
                                                    className={
                                                        open
                                                            ? 'h-3.5 w-3.5 text-[var(--st-text-secondary)] transition-transform'
                                                            : 'h-3.5 w-3.5 -rotate-90 text-[var(--st-text-secondary)] transition-transform'
                                                    }
                                                    strokeWidth={1.75}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </CollapsibleTrigger>
                                        <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                                            Last run {fmtRel(cat.lastRefreshAt)}
                                        </span>
                                    </div>
                                    <CollapsibleContent className="mt-3">
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            {cat.items.map(({ href, label, description, iconName }) => {
                                                const ItemIcon = resolveIcon(iconName);
                                                const isFav = favorites.includes(href);
                                                return (
                                                    <Link
                                                        key={href}
                                                        href={href}
                                                        className="relative group flex h-full flex-col rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 shadow-sm transition-shadow hover:shadow-[var(--st-shadow-md)]"
                                                    >
                                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => toggleFavorite(e, href)}
                                                                className={`text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors ${isFav ? 'text-[var(--st-text)] opacity-100' : ''}`}
                                                                aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                                            >
                                                                <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]">
                                                                <ItemIcon
                                                                    className="h-[18px] w-[18px] text-[var(--st-text)]"
                                                                    strokeWidth={1.75}
                                                                    aria-hidden="true"
                                                                />
                                                            </div>
                                                            <div className="min-w-0 flex-1 pr-6">
                                                                <h3 className="text-[14px] font-medium text-[var(--st-text)]">
                                                                    {label}
                                                                </h3>
                                                                <p className="mt-1 text-[12.5px] leading-snug text-[var(--st-text-secondary)]">
                                                                    {description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </section>
                        );
                    })}
                </div>

                <aside className="flex flex-col gap-4">
                    <Card className="p-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h2 className="text-[14px] font-medium text-[var(--st-text)]">Recently viewed</h2>
                        </div>
                        {recentRuns.length === 0 ? (
                            <p className="py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                                No report runs yet. Run any report to see history here.
                            </p>
                        ) : (
                            <ul className="divide-y divide-[var(--st-border)]">
                                {recentRuns.map((run) => (
                                    <li key={run.runId}>
                                        <Link
                                            href={`/dashboard/sabbi/reports/${run.definitionId}/runs/${run.runId}`}
                                            className="block py-2.5 hover:bg-[var(--st-bg-muted)]"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-[13px] text-[var(--st-text)]">
                                                        {run.name}
                                                    </div>
                                                    <div className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                                                        {run.rowCount} rows · {fmtRel(run.startedAt)}
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant={statusTone[run.status] ?? 'outline'}
                                                    className="capitalize"
                                                >
                                                    {run.status}
                                                </Badge>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="mt-3">
                            <Link
                                href="/dashboard/sabbi/reports/saved"
                                className="text-[12.5px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                            >
                                View saved reports
                            </Link>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
}

function CategoryChip({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={onClick}
        >
            {label}
        </Button>
    );
}
