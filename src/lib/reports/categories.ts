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
        href: '/dashboard/sabbi/reports/income',
        label: 'Income',
        description: 'Revenue by period from paid invoices.',
        icon: Wallet,
    },
    {
        href: '/dashboard/sabbi/reports/expense',
        label: 'Expense',
        description: 'Expenses by period and category.',
        icon: Receipt,
    },
    {
        href: '/dashboard/sabbi/reports/profit-loss',
        label: 'Profit & Loss',
        description: 'Income minus expenses grouped by month.',
        icon: TrendingUp,
    },
    {
        href: '/dashboard/sabbi/reports/tax',
        label: 'Tax',
        description: 'Tax collected on invoices and paid on expenses.',
        icon: Calculator,
    },
    {
        href: '/dashboard/sabbi/reports/invoice-aging',
        label: 'Invoice Aging',
        description: 'Outstanding invoices by age buckets.',
        icon: Clock4,
    },
    {
        href: '/dashboard/sabbi/reports/payment-report',
        label: 'Payments',
        description: 'Payments by gateway/method.',
        icon: CreditCard,
    },
];

const sales = [
    {
        href: '/dashboard/sabbi/reports/sales-deals',
        label: 'Sales Deals',
        description: 'Deal conversion funnel by stage.',
        icon: Target,
    },
    {
        href: '/dashboard/sabbi/reports/leads-conversion',
        label: 'Leads Conversion',
        description: 'Conversion rate and average cycle time.',
        icon: ArrowRightLeft,
    },
    {
        href: '/dashboard/sabbi/reports/top-clients',
        label: 'Top Clients',
        description: 'Clients ranked by revenue.',
        icon: Crown,
    },
    {
        href: '/dashboard/sabbi/reports/top-products',
        label: 'Top Products',
        description: 'Products ranked by units & revenue.',
        icon: Package,
    },
];

const tasks = [
    {
        href: '/dashboard/sabbi/reports/project-status-report',
        label: 'Project Status',
        description: 'Projects grouped by status with completion %.',
        icon: FolderKanban,
    },
    {
        href: '/dashboard/sabbi/reports/task-report',
        label: 'Task Report',
        description: 'Tasks by assignee, status and priority.',
        icon: ListChecks,
    },
    {
        href: '/dashboard/sabbi/reports/overdue-tasks',
        label: 'Overdue Tasks',
        description: 'Tasks past their due date.',
        icon: AlertTriangle,
    },
];

const people = [
    {
        href: '/dashboard/sabbi/reports/attendance-report',
        label: 'Attendance',
        description: 'Employee attendance matrix by month.',
        icon: CalendarDays,
    },
    {
        href: '/dashboard/sabbi/reports/leave-report',
        label: 'Leaves',
        description: 'Leaves taken by employee and type.',
        icon: PlaneTakeoff,
    },
    {
        href: '/dashboard/sabbi/reports/late-report',
        label: 'Late Arrivals',
        description: 'Late arrivals by employee.',
        icon: Timer,
    },
    {
        href: '/dashboard/sabbi/reports/leave-balance-report',
        label: 'Leave Balance',
        description: 'Remaining balance per employee and type.',
        icon: Scale,
    },
    {
        href: '/dashboard/sabbi/reports/birthday-anniversary',
        label: 'Birthdays & Anniversaries',
        description: 'Upcoming birthdays and work anniversaries.',
        icon: Cake,
    },
];

const support = [
    {
        href: '/dashboard/sabbi/reports/ticket-report',
        label: 'Tickets',
        description: 'Tickets by status, channel, agent with SLA metrics.',
        icon: Ticket,
    },
    {
        href: '/dashboard/sabbi/reports/agent-performance',
        label: 'Agent Performance',
        description: 'Per-agent tickets closed and average resolution.',
        icon: UserCog,
    },
];

const gst = [
    {
        href: '/dashboard/sabbi/reports/gstr-1',
        label: 'GSTR-1',
        description: 'Outward supplies return — sales for the period.',
        icon: FileBarChart,
    },
    {
        href: '/dashboard/sabbi/reports/gstr-2b',
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
