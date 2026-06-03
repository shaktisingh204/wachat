/**
 * Report catalogue for the reports hub (`/dashboard/sabbi/reports`).
 *
 * Icons are stored as string NAMES (not lucide component functions) so the
 * catalogue can be passed from the Server Component page straight to the
 * `ReportsHubClient` Client Component without crossing the RSC serialization
 * boundary with non-serializable function values. The client resolves names
 * back to lucide components via its own ICON_MAP.
 */

const finance = [
    {
        href: '/dashboard/sabbi/reports/income',
        label: 'Income',
        description: 'Revenue by period from paid invoices.',
        iconName: 'Wallet',
    },
    {
        href: '/dashboard/sabbi/reports/expense',
        label: 'Expense',
        description: 'Expenses by period and category.',
        iconName: 'Receipt',
    },
    {
        href: '/dashboard/sabbi/reports/profit-loss',
        label: 'Profit & Loss',
        description: 'Income minus expenses grouped by month.',
        iconName: 'TrendingUp',
    },
    {
        href: '/dashboard/sabbi/reports/tax',
        label: 'Tax',
        description: 'Tax collected on invoices and paid on expenses.',
        iconName: 'Calculator',
    },
    {
        href: '/dashboard/sabbi/reports/invoice-aging',
        label: 'Invoice Aging',
        description: 'Outstanding invoices by age buckets.',
        iconName: 'Clock4',
    },
    {
        href: '/dashboard/sabbi/reports/payment-report',
        label: 'Payments',
        description: 'Payments by gateway/method.',
        iconName: 'CreditCard',
    },
];

const sales = [
    {
        href: '/dashboard/sabbi/reports/sales-deals',
        label: 'Sales Deals',
        description: 'Deal conversion funnel by stage.',
        iconName: 'Target',
    },
    {
        href: '/dashboard/sabbi/reports/leads-conversion',
        label: 'Leads Conversion',
        description: 'Conversion rate and average cycle time.',
        iconName: 'ArrowRightLeft',
    },
    {
        href: '/dashboard/sabbi/reports/top-clients',
        label: 'Top Clients',
        description: 'Clients ranked by revenue.',
        iconName: 'Crown',
    },
    {
        href: '/dashboard/sabbi/reports/top-products',
        label: 'Top Products',
        description: 'Products ranked by units & revenue.',
        iconName: 'Package',
    },
];

const tasks = [
    {
        href: '/dashboard/sabbi/reports/project-status-report',
        label: 'Project Status',
        description: 'Projects grouped by status with completion %.',
        iconName: 'FolderKanban',
    },
    {
        href: '/dashboard/sabbi/reports/task-report',
        label: 'Task Report',
        description: 'Tasks by assignee, status and priority.',
        iconName: 'ListChecks',
    },
    {
        href: '/dashboard/sabbi/reports/overdue-tasks',
        label: 'Overdue Tasks',
        description: 'Tasks past their due date.',
        iconName: 'AlertTriangle',
    },
];

const people = [
    {
        href: '/dashboard/sabbi/reports/attendance-report',
        label: 'Attendance',
        description: 'Employee attendance matrix by month.',
        iconName: 'CalendarDays',
    },
    {
        href: '/dashboard/sabbi/reports/leave-report',
        label: 'Leaves',
        description: 'Leaves taken by employee and type.',
        iconName: 'PlaneTakeoff',
    },
    {
        href: '/dashboard/sabbi/reports/late-report',
        label: 'Late Arrivals',
        description: 'Late arrivals by employee.',
        iconName: 'Timer',
    },
    {
        href: '/dashboard/sabbi/reports/leave-balance-report',
        label: 'Leave Balance',
        description: 'Remaining balance per employee and type.',
        iconName: 'Scale',
    },
    {
        href: '/dashboard/sabbi/reports/birthday-anniversary',
        label: 'Birthdays & Anniversaries',
        description: 'Upcoming birthdays and work anniversaries.',
        iconName: 'Cake',
    },
];

const support = [
    {
        href: '/dashboard/sabbi/reports/ticket-report',
        label: 'Tickets',
        description: 'Tickets by status, channel, agent with SLA metrics.',
        iconName: 'Ticket',
    },
    {
        href: '/dashboard/sabbi/reports/agent-performance',
        label: 'Agent Performance',
        description: 'Per-agent tickets closed and average resolution.',
        iconName: 'UserCog',
    },
];

const gst = [
    {
        href: '/dashboard/sabbi/reports/gstr-1',
        label: 'GSTR-1',
        description: 'Outward supplies return — sales for the period.',
        iconName: 'FileBarChart',
    },
    {
        href: '/dashboard/sabbi/reports/gstr-2b',
        label: 'GSTR-2B',
        description: 'Auto-drafted inward supplies return from vendors.',
        iconName: 'FileBarChart',
    },
];

export interface RawCategoryItem {
    href: string;
    label: string;
    description: string;
    iconName: string;
}

export interface RawCategoryDef {
    id: string;
    title: string;
    iconName: string;
    items: RawCategoryItem[];
}

export const REPORT_CATEGORIES: RawCategoryDef[] = [
    { id: 'sales', title: 'Sales', iconName: 'Briefcase', items: sales },
    { id: 'finance', title: 'Finance', iconName: 'Banknote', items: finance },
    { id: 'tasks', title: 'Projects & Tasks', iconName: 'FolderKanban', items: tasks },
    { id: 'people', title: 'People', iconName: 'Users', items: people },
    { id: 'support', title: 'Support', iconName: 'LifeBuoy', items: support },
    { id: 'gst', title: 'GST', iconName: 'ScrollText', items: gst },
];
