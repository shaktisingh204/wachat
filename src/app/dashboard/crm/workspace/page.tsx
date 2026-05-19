import {
    Award,
    BookOpen,
    CalendarDays,
    Megaphone,
    MessageSquare,
    Bell,
    StickyNote,
    Sparkles,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    HubRecentList,
    type HubKpi,
    type HubQuickLink,
    type HubRecentRow,
} from '../_components/hub-kpi-grid';
import {
    countByUser,
    formatDate,
    recentByUser,
    startOfDay,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface WorkspaceItemDoc {
    _id: string;
    title?: string;
    name?: string;
    createdAt?: string;
    startsAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/workspace/announcements', title: 'Announcements', description: 'Company-wide announcements pinned to the workspace.', icon: Megaphone },
    { href: '/dashboard/crm/workspace/notices', title: 'Notices', description: 'Time-sensitive notices and reminders.', icon: Bell },
    { href: '/dashboard/crm/workspace/awards', title: 'Awards', description: 'Recognise teammates with badges and awards.', icon: Award },
    { href: '/dashboard/crm/workspace/events', title: 'Events', description: 'Upcoming workspace events and meetings.', icon: CalendarDays },
    { href: '/dashboard/crm/workspace/discussions', title: 'Discussions', description: 'Long-form threaded discussions.', icon: MessageSquare },
    { href: '/dashboard/crm/workspace/sticky-notes', title: 'Sticky Notes', description: 'Personal and shared notes on the workspace board.', icon: StickyNote },
    { href: '/dashboard/crm/workspace/knowledge-base', title: 'Knowledge Base', description: 'Internal documentation and runbooks.', icon: BookOpen },
];

export default async function CrmWorkspaceHubPage() {
    const today = startOfDay();

    const [discussionsCount, pendingAnnouncements, upcomingEvents, recentAnnouncements, recentEvents, recentDiscussions] = await Promise.all([
        countByUser('crm_discussions'),
        countByUser('crm_notices', { publishedAt: null }),
        countByUser('crm_events', { startsAt: { $gte: today } }),
        recentByUser<WorkspaceItemDoc>('crm_notices', { sortField: 'createdAt', limit: 3 }),
        recentByUser<WorkspaceItemDoc>('crm_events', { sortField: 'startsAt', limit: 3 }),
        recentByUser<WorkspaceItemDoc>('crm_discussions', { sortField: 'createdAt', limit: 3 }),
    ]);

    const kpis: HubKpi[] = [
        {
            label: 'Discussions',
            value: discussionsCount,
            icon: MessageSquare,
            href: '/dashboard/crm/workspace/discussions',
        },
        {
            label: 'Upcoming Events',
            value: upcomingEvents,
            icon: CalendarDays,
            href: '/dashboard/crm/workspace/events',
        },
        {
            label: 'Draft Notices',
            value: pendingAnnouncements,
            icon: Bell,
            tone: pendingAnnouncements > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/workspace/notices',
        },
        {
            label: 'Activity',
            value: discussionsCount + upcomingEvents,
            icon: Sparkles,
        },
    ];

    const recentRows: HubRecentRow[] = [
        ...recentAnnouncements.map((a) => ({
            id: `n-${a._id}`,
            primary: a.title || a.name || 'Notice',
            secondary: 'Notice',
            trailing: formatDate(a.createdAt),
            href: '/dashboard/crm/workspace/notices',
        })),
        ...recentEvents.map((e) => ({
            id: `e-${e._id}`,
            primary: e.title || e.name || 'Event',
            secondary: 'Event',
            trailing: formatDate(e.startsAt || e.createdAt),
            href: '/dashboard/crm/workspace/events',
        })),
        ...recentDiscussions.map((d) => ({
            id: `d-${d._id}`,
            primary: d.title || d.name || 'Discussion',
            secondary: 'Discussion',
            trailing: formatDate(d.createdAt),
            href: '/dashboard/crm/workspace/discussions',
        })),
    ].slice(0, 8);

    return (
        <EntityListShell
            title="Workspace"
            subtitle="The team hub — announcements, notices, recognition, and discussions."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <HubRecentList
                    title="Newest across workspace"
                    rows={recentRows}
                    emptyHint="No workspace activity yet."
                />
            </div>
        </EntityListShell>
    );
}
