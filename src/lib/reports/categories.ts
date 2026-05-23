import {
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

const finance = [
    {
        href: '/dashboard/crm/reports/income',
        label: 'Income',
        description: 'Revenue by period from paid invoices.',
        icon: Wallet,
    },
    {
        href: '/dashboard/crm/reports/expense',
        label: 'Expense',
        description: 'Expenses by period and category.',
        icon: Receipt,
    },
    {
        href: '/dashboard/crm/reports/profit-loss',
        label: 'Profit & Loss',
        description: 'Income minus expenses grouped by month.',
        icon: TrendingUp,
    },
    {
        href: '/dashboard/crm/reports/tax',
        label: 'Tax',
        description: 'Tax collected on invoices and paid on expenses.',
        icon: Calculator,
    },
    {
        href: '/dashboard/crm/reports/invoice-aging',
        label: 'Invoice Aging',
        description: 'Outstanding invoices by age buckets.',
        icon: Clock4,
    },
    {
        href: '/dashboard/crm/reports/payment-report',
        label: 'Payments',
        description: 'Payments by gateway/method.',
        icon: CreditCard,
    },
];

const sales = [
    {
        href: '/dashboard/crm/reports/sales-deals',
        label: 'Sales Deals',
        description: 'Deal conversion funnel by stage.',
        icon: Target,
    },
    {
        href: '/dashboard/crm/reports/leads-conversion',
        label: 'Leads Conversion',
        description: 'Conversion rate and average cycle time.',
        icon: ArrowRightLeft,
    },
    {
        href: '/dashboard/crm/reports/top-clients',
        label: 'Top Clients',
        description: 'Clients ranked by revenue.',
        icon: Crown,
    },
    {
        href: '/dashboard/crm/reports/top-products',
        label: 'Top Products',
        description: 'Products ranked by units & revenue.',
        icon: Package,
    },
];

const tasks = [
    {
        href: '/dashboard/crm/reports/project-status-report',
        label: 'Project Status',
        description: 'Projects grouped by status with completion %.',
        icon: FolderKanban,
    },
    {
        href: '/dashboard/crm/reports/task-report',
        label: 'Task Report',
        description: 'Tasks by assignee, status and priority.',
        icon: ListChecks,
    },
    {
        href: '/dashboard/crm/reports/overdue-tasks',
        label: 'Overdue Tasks',
        description: 'Tasks past their due date.',
        icon: AlertTriangle,
    },
];

const people = [
    {
        href: '/dashboard/crm/reports/attendance-report',
        label: 'Attendance',
        description: 'Employee attendance matrix by month.',
        icon: CalendarDays,
    },
    {
        href: '/dashboard/crm/reports/leave-report',
        label: 'Leaves',
        description: 'Leaves taken by employee and type.',
        icon: PlaneTakeoff,
    },
    {
        href: '/dashboard/crm/reports/late-report',
        label: 'Late Arrivals',
        description: 'Late arrivals by employee.',
        icon: Timer,
    },
    {
        href: '/dashboard/crm/reports/leave-balance-report',
        label: 'Leave Balance',
        description: 'Remaining balance per employee and type.',
        icon: Scale,
    },
    {
        href: '/dashboard/crm/reports/birthday-anniversary',
        label: 'Birthdays & Anniversaries',
        description: 'Upcoming birthdays and work anniversaries.',
        icon: Cake,
    },
];

const support = [
    {
        href: '/dashboard/crm/reports/ticket-report',
        label: 'Tickets',
        description: 'Tickets by status, channel, agent with SLA metrics.',
        icon: Ticket,
    },
    {
        href: '/dashboard/crm/reports/agent-performance',
        label: 'Agent Performance',
        description: 'Per-agent tickets closed and average resolution.',
        icon: UserCog,
    },
];

const gst = [
    {
        href: '/dashboard/crm/reports/gstr-1',
        label: 'GSTR-1',
        description: 'Outward supplies return — sales for the period.',
        icon: FileBarChart,
    },
    {
        href: '/dashboard/crm/reports/gstr-2b',
        label: 'GSTR-2B',
        description: 'Auto-drafted inward supplies return from vendors.',
        icon: FileBarChart,
    },
];

export interface RawCategoryDef {
    id: string;
    title: string;
    icon: React.ElementType;
    items: typeof finance;
}

export const REPORT_CATEGORIES: RawCategoryDef[] = [
    { id: 'sales', title: 'Sales', icon: Briefcase, items: sales },
    { id: 'finance', title: 'Finance', icon: Banknote, items: finance },
    { id: 'tasks', title: 'Projects & Tasks', icon: FolderKanban, items: tasks },
    { id: 'people', title: 'People', icon: Users, items: people },
    { id: 'support', title: 'Support', icon: LifeBuoy, items: support },
    { id: 'gst', title: 'GST', icon: ScrollText, items: gst },
];
