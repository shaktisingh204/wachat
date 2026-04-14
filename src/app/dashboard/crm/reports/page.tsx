import {
  Activity,
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
} from 'lucide-react';

import { CrmPageHeader } from '../_components/crm-page-header';

interface SectionLink {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const finance: SectionLink[] = [
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

const sales: SectionLink[] = [
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

const projects: SectionLink[] = [
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

const hr: SectionLink[] = [
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

const support: SectionLink[] = [
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

const compliance: SectionLink[] = [
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

function Section({
  title,
  items,
}: {
  title: string;
  items: SectionLink[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-clay-ink">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ href, label, description, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="group flex h-full flex-col rounded-clay-lg border border-clay-border bg-clay-surface p-5 shadow-clay-card transition-colors hover:border-clay-border-strong"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                <Icon className="h-5 w-5 text-clay-rose-ink" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14.5px] font-semibold text-clay-ink">
                  {label}
                </h3>
                <p className="mt-1 text-[12.5px] leading-snug text-clay-ink-muted">
                  {description}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function ReportsOverviewPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Reports"
        subtitle="Financial, sales, HR, support and compliance reports in one place."
        icon={Activity}
      />
      <Section title="Finance" items={finance} />
      <Section title="Sales" items={sales} />
      <Section title="Projects & Tasks" items={projects} />
      <Section title="HR" items={hr} />
      <Section title="Support" items={support} />
      <Section title="Compliance" items={compliance} />
    </div>
  );
}
