import {
    BadgeCheck,
    BarChart3,
    Bot,
    Building2,
    CalendarClock,
    ClipboardList,
    Contact,
    FileSpreadsheet,
    Filter,
    GitBranch,
    Handshake,
    LayoutList,
    ListChecks,
    ListTree,
    Package,
    PieChart,
    ShieldCheck,
    Sparkles,
    StickyNote,
    Tag,
    Target,
    TrendingUp,
    UserCog,
    Users,
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
    formatCurrency,
    formatDate,
    recentByUser,
} from '../_components/hub-data';

export const dynamic = 'force-dynamic';

interface LeadDoc {
    _id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    status?: string;
    stage?: string;
    createdAt?: string;
}

interface DealDoc {
    _id: string;
    title?: string;
    name?: string;
    value?: number;
    amount?: number;
    stage?: string;
    expectedCloseDate?: string;
    createdAt?: string;
}

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/sales-crm/all-leads', title: 'All Leads', description: 'Every lead in the system, regardless of stage.', icon: Users },
    { href: '/dashboard/crm/sales-crm/leads-summary', title: 'Leads Summary', description: 'Headline metrics across every active pipeline.', icon: TrendingUp },
    { href: '/dashboard/crm/sales-crm/leads', title: 'Leads', description: 'Working list of leads to act on next.', icon: Filter },
    { href: '/dashboard/crm/sales-crm/clients', title: 'Clients', description: 'Converted lead → client accounts.', icon: Building2 },
    { href: '/dashboard/crm/sales-crm/contacts', title: 'Contacts', description: 'People associated with leads and clients.', icon: Contact },
    { href: '/dashboard/crm/sales-crm/deals', title: 'Deals', description: 'Open opportunities being worked.', icon: Handshake },
    { href: '/dashboard/sabbigin/pipelines', title: 'Pipelines', description: 'Stage-based pipelines and their funnels.', icon: GitBranch },
    { href: '/dashboard/crm/sales-crm/pipeline-stages', title: 'Pipeline Stages', description: 'Configure stages across pipelines.', icon: ListTree },
    { href: '/dashboard/crm/sales-crm/all-pipelines', title: 'All Pipelines', description: 'Flat list of every pipeline.', icon: LayoutList },
    { href: '/dashboard/crm/sales-crm/agents', title: 'Lead Agents', description: 'Employees assigned to specific leads.', icon: UserCog },
    { href: '/dashboard/crm/sales-crm/sources', title: 'Lead Sources', description: 'Where leads are coming from.', icon: Tag },
    { href: '/dashboard/crm/sales-crm/statuses', title: 'Lead Statuses', description: 'Lifecycle statuses applied to leads.', icon: BadgeCheck },
    { href: '/dashboard/crm/sales-crm/categories', title: 'Categories', description: 'Categorisation taxonomy for leads.', icon: ListChecks },
    { href: '/dashboard/crm/sales-crm/tasks', title: 'Tasks', description: 'Follow-ups and call-back tasks per lead.', icon: ClipboardList },
    { href: '/dashboard/crm/sales-crm/notes', title: 'Notes', description: 'Lead notes — calls, meetings, observations.', icon: StickyNote },
    { href: '/dashboard/crm/sales-crm/products', title: 'Lead Products', description: 'Products of interest, line-itemised by lead.', icon: Package },
    { href: '/dashboard/crm/sales-crm/forms', title: 'Forms', description: 'Public lead-capture forms.', icon: ClipboardList },
    { href: '/dashboard/crm/sales-crm/custom-forms', title: 'Custom Fields', description: 'Extra fields you collect on leads.', icon: FileSpreadsheet },
    { href: '/dashboard/crm/sales-crm/automations', title: 'Automations', description: 'Rules that fire on lead lifecycle events.', icon: Bot },
    { href: '/dashboard/crm/sales-crm/conversions', title: 'Conversions', description: 'Lead → client conversion log.', icon: Target },
    { href: '/dashboard/crm/sales-crm/consent', title: 'Consent', description: 'GDPR / marketing consent records.', icon: ShieldCheck },
    { href: '/dashboard/crm/sales-crm/lead-source-report', title: 'Source Report', description: 'Performance by lead source.', icon: PieChart },
    { href: '/dashboard/crm/sales-crm/team-sales-report', title: 'Team Report', description: 'Performance broken down by sales rep.', icon: BarChart3 },
    { href: '/dashboard/crm/sales-crm/client-performance-report', title: 'Client Report', description: 'Revenue and activity per client.', icon: BarChart3 },
    { href: '/dashboard/crm/sales-crm/settings', title: 'Sales-CRM Settings', description: 'Form IDs, share links, and module settings.', icon: Sparkles },
];

export default async function CrmSalesCrmHubPage() {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [openLeads, qualifiedLeads, dealsInPipeline, closingThisWeek, recentLeads, topDeals] = await Promise.all([
        countByUser('crm_leads', { status: { $nin: ['converted', 'lost', 'archived'] } }),
        countByUser('crm_leads', { status: 'qualified' }),
        countByUser('crm_deals', { status: { $nin: ['won', 'lost'] } }),
        countByUser('crm_deals', {
            status: { $nin: ['won', 'lost'] },
            expectedCloseDate: { $lte: weekEnd },
        }),
        recentByUser<LeadDoc>('crm_leads', { sortField: 'createdAt', limit: 5 }),
        recentByUser<DealDoc>('crm_deals', {
            filter: { status: { $nin: ['won', 'lost'] } },
            sortField: 'value',
            limit: 3,
        }),
    ]);

    const kpis: HubKpi[] = [
        {
            label: 'Open Leads',
            value: openLeads.toLocaleString(),
            icon: Users,
            href: '/dashboard/crm/sales-crm/leads',
        },
        {
            label: 'Qualified',
            value: qualifiedLeads.toLocaleString(),
            icon: BadgeCheck,
            tone: 'success',
            href: '/dashboard/crm/sales-crm/leads?status=qualified',
        },
        {
            label: 'Deals in Pipeline',
            value: dealsInPipeline.toLocaleString(),
            icon: Handshake,
            href: '/dashboard/crm/sales-crm/deals',
        },
        {
            label: 'Closing This Week',
            value: closingThisWeek,
            icon: CalendarClock,
            tone: closingThisWeek > 0 ? 'warning' : 'default',
            href: '/dashboard/crm/sales-crm/deals?closing=week',
        },
    ];

    const topRows: HubRecentRow[] = topDeals.map((d) => ({
        id: `deal-${d._id}`,
        primary: d.title || d.name || 'Deal',
        secondary: d.stage || '—',
        trailing: formatCurrency(d.value ?? d.amount ?? 0),
        href: `/dashboard/crm/sales-crm/deals/${d._id}`,
    }));

    const leadRows: HubRecentRow[] = recentLeads.map((l) => ({
        id: `lead-${l._id}`,
        primary: l.name || [l.firstName, l.lastName].filter(Boolean).join(' ') || 'Lead',
        secondary: l.company || l.status || l.stage || '—',
        trailing: formatDate(l.createdAt),
        href: `/dashboard/crm/sales-crm/leads/${l._id}`,
    }));

    return (
        <EntityListShell
            title="Sales CRM"
            subtitle="Leads, deals, pipelines, automations, and lead-funnel reporting."
        >
            <div className="flex flex-col gap-6">
                <HubKpiGrid kpis={kpis} />
                <HubQuickLinkGrid links={QUICK_LINKS} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <HubRecentList
                        title="Top open deals"
                        rows={topRows}
                        emptyHint="No deals in pipeline."
                        viewAllHref="/dashboard/crm/sales-crm/deals"
                    />
                    <HubRecentList
                        title="Recent leads"
                        rows={leadRows}
                        emptyHint="No leads yet."
                        viewAllHref="/dashboard/crm/sales-crm/leads"
                    />
                </div>
            </div>
        </EntityListShell>
    );
}
