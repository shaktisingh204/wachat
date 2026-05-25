'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    FileText,
    FolderKanban,
    LifeBuoy,
    Receipt,
    RefreshCw,
    GripVertical,
    Settings2,
    Eye,
    EyeOff
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
    getClientPortalActivity,
    getClientPortalKpis,
    type ClientPortalKpis,
    type ClientActivityItem
} from '@/app/actions/client-portal.actions';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import { Button } from '@/components/zoruui/button';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/zoruui/dialog';

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

type WidgetId = 'kpis' | 'activity' | 'links';

interface WidgetState {
    id: WidgetId;
    visible: boolean;
}

const defaultWidgets: WidgetState[] = [
    { id: 'kpis', visible: true },
    { id: 'activity', visible: true },
    { id: 'links', visible: true },
];

interface SortableWidgetProps {
    id: WidgetId;
    children: React.ReactNode;
}

function SortableWidget({ id, children }: SortableWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group flex items-start gap-2">
            <div
                {...attributes}
                {...listeners}
                className="mt-4 cursor-grab active:cursor-grabbing text-zoru-ink-muted opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}

export function ClientOverviewContent({
    initialKpis,
    initialActivity
}: {
    initialKpis: ClientPortalKpis;
    initialActivity: ClientActivityItem[];
}) {
    const [kpis, setKpis] = useState<ClientPortalKpis>(initialKpis);
    const [activity, setActivity] = useState<ClientActivityItem[]>(initialActivity);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [widgets, setWidgets] = useState<WidgetState[]>(defaultWidgets);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('sabnode_client_dashboard');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length === 3) {
                    setWidgets(parsed);
                }
            } catch (e) { }
        }
    }, []);

    const saveWidgets = (newWidgets: WidgetState[]) => {
        setWidgets(newWidgets);
        localStorage.setItem('sabnode_client_dashboard', JSON.stringify(newWidgets));
    };

    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [newKpis, newActivity] = await Promise.all([
                getClientPortalKpis(),
                getClientPortalActivity(10),
            ]);
            setKpis(newKpis);
            setActivity(newActivity);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // Real-time updates for recent activity (poll every 30s)
    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = widgets.findIndex((w) => w.id === active.id);
            const newIndex = widgets.findIndex((w) => w.id === over.id);
            saveWidgets(arrayMove(widgets, oldIndex, newIndex));
        }
    };

    const toggleWidget = (id: WidgetId) => {
        saveWidgets(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
    };

    if (!mounted) return null;

    const visibleWidgets = widgets.filter(w => w.visible);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-zoru-ink">Welcome back</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        A snapshot of your account.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={refreshData}
                        disabled={isRefreshing}
                        leading={<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
                    >
                        Refresh
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" leading={<Settings2 className="h-4 w-4" />}>
                                Customize
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Customize Dashboard</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <p className="text-sm text-zoru-ink-muted">
                                    Toggle the visibility of your dashboard widgets. You can drag and drop them on the dashboard to reorder.
                                </p>
                                <div className="space-y-2">
                                    {widgets.map(w => (
                                        <div key={w.id} className="flex items-center justify-between p-3 border border-zoru-line rounded-[var(--zoru-radius-sm)]">
                                            <span className="font-medium capitalize">{w.id === 'kpis' ? 'Quick Stats' : w.id === 'activity' ? 'Recent Activity' : 'Quick Links'}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => toggleWidget(w.id)}
                                            >
                                                {w.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-zoru-ink-muted" />}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={visibleWidgets.map(w => w.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="flex flex-col gap-6">
                        {visibleWidgets.map((w) => {
                            if (w.id === 'kpis') {
                                return (
                                    <SortableWidget key="kpis" id="kpis">
                                        <KpisWidget kpis={kpis} />
                                    </SortableWidget>
                                );
                            }
                            if (w.id === 'activity') {
                                return (
                                    <SortableWidget key="activity" id="activity">
                                        <ActivityWidget activity={activity} />
                                    </SortableWidget>
                                );
                            }
                            if (w.id === 'links') {
                                return (
                                    <SortableWidget key="links" id="links">
                                        <QuickLinksWidget />
                                    </SortableWidget>
                                );
                            }
                            return null;
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

function KpisWidget({ kpis }: { kpis: ClientPortalKpis }) {
    const tiles = [
        { label: 'Open Tickets', value: kpis.openTickets, icon: LifeBuoy, href: '/portal/client/tickets' },
        { label: 'Unpaid Invoices', value: kpis.unpaidInvoices, icon: Receipt, href: '/portal/client/invoices' },
        { label: 'Active Projects', value: kpis.activeProjects, icon: FolderKanban, href: '/portal/client/projects' },
        { label: 'Pending Estimates', value: kpis.pendingEstimates, icon: FileText, href: '/portal/client/estimates' },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => {
                const Icon = tile.icon;
                return (
                    <Link key={tile.label} href={tile.href}>
                        <Card className="transition-colors hover:bg-zoru-surface-2 h-full">
                            <ZoruCardContent className="flex items-center justify-between p-4 h-full">
                                <div>
                                    <div className="text-xs text-zoru-ink-muted">{tile.label}</div>
                                    <div className="mt-1 text-2xl font-semibold text-zoru-ink">{tile.value}</div>
                                </div>
                                <Icon className="h-5 w-5 text-zoru-ink-muted" />
                            </ZoruCardContent>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}

function ActivityWidget({ activity }: { activity: ClientActivityItem[] }) {
    return (
        <Card>
            <ZoruCardHeader>
                <ZoruCardTitle>Recent Activity</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                {activity.length === 0 ? (
                    <div className="py-6 text-center text-sm text-zoru-ink-muted">
                        No recent activity yet.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {activity.map((it, idx) => (
                            <li key={`${it.link}-${idx}`} className="flex items-start gap-3">
                                <span
                                    aria-hidden
                                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-primary"
                                />
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={it.link}
                                        className="block truncate text-sm font-medium text-zoru-ink hover:underline hover:text-zoru-primary transition-colors"
                                    >
                                        {it.title}
                                    </Link>
                                    <div className="text-[11px] text-zoru-ink-muted mt-0.5">
                                        {formatRelative(it.when)}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ZoruCardContent>
        </Card>
    );
}

function QuickLinksWidget() {
    const quickLinks = [
        { label: 'Create Ticket', href: '/portal/client/tickets?new=1', icon: LifeBuoy },
        { label: 'View Projects', href: '/portal/client/projects', icon: FolderKanban },
        { label: 'Pay Invoice', href: '/portal/client/invoices', icon: Receipt },
    ];

    return (
        <Card>
            <ZoruCardHeader>
                <ZoruCardTitle>Quick Links</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {quickLinks.map((q) => {
                        const Icon = q.icon;
                        return (
                            <Link
                                key={q.label}
                                href={q.href}
                                className="flex items-center gap-3 rounded-[var(--zoru-radius-sm)] border border-zoru-line p-4 text-sm font-medium text-zoru-ink transition-colors hover:bg-zoru-surface-2 hover:border-zoru-primary/30"
                            >
                                <Icon className="h-5 w-5 text-zoru-primary" />
                                <span>{q.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </ZoruCardContent>
        </Card>
    );
}
