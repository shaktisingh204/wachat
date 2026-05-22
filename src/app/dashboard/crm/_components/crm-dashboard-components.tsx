'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Card,
  ScrollArea,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Users,
  UserPlus,
  Handshake,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

function SectionHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
        <Icon className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] leading-tight text-zoru-ink">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 p-10 text-center">
      <Icon className="mb-3 h-10 w-10 text-zoru-ink-muted/70" strokeWidth={1.5} />
      <p className="text-[13px] text-zoru-ink-muted">{text}</p>
    </div>
  );
}

interface RecentDealsCardProps {
  deals: any[];
  currency: string;
}

export const RecentDealsCard = ({ deals, currency }: RecentDealsCardProps) => (
  <Card className="p-6 md:col-span-2">
    <SectionHead
      icon={Handshake}
      title="Recent Deals"
      subtitle="Latest deals created in your pipeline"
    />
    {deals.length === 0 ? (
      <EmptyState icon={Handshake} text="No recent deals found." />
    ) : (
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Deal Name</ZoruTableHead>
            <ZoruTableHead>Stage</ZoruTableHead>
            <ZoruTableHead className="text-right">Value</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {deals.map((deal) => (
            <ZoruTableRow key={deal._id}>
              <ZoruTableCell className="font-medium text-zoru-ink">{deal.name}</ZoruTableCell>
              <ZoruTableCell>
                <Badge variant="ghost">{deal.stage}</Badge>
              </ZoruTableCell>
              <ZoruTableCell className="text-right font-medium text-zoru-ink">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: deal.currency || currency || 'USD',
                }).format(deal.value || 0)}
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </Table>
    )}
  </Card>
);

interface UpcomingTasksCardProps {
  tasks: any[];
}

export const UpcomingTasksCard = ({ tasks }: UpcomingTasksCardProps) => (
  <Card className="p-6">
    <SectionHead
      icon={Calendar}
      title="Upcoming Tasks"
      subtitle="Scheduled activities needing attention"
    />
    {tasks.length === 0 ? (
      <EmptyState icon={CheckCircle2} text="No pending tasks." />
    ) : (
      <ScrollArea className="h-[250px] pr-3">
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task._id}
              className="flex items-start justify-between gap-3 border-b border-zoru-line pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium leading-tight text-zoru-ink">
                  {task.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-zoru-ink-muted">
                  <Badge variant={task.priority === 'High' ? 'danger' : 'ghost'}>
                    {task.priority || 'Normal'}
                  </Badge>
                  {task.dueDate && (
                    <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2">
                {task.type === 'Call' ? (
                  <Users className="h-3 w-3 text-zoru-ink" strokeWidth={1.75} />
                ) : (
                  <FileText className="h-3 w-3 text-zoru-ink" strokeWidth={1.75} />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    )}
  </Card>
);

interface PipelineBreakdownCardProps {
  stages: { stage: string; count: number; value: number }[];
  currency: string;
}

export const PipelineBreakdownCard = ({ stages, currency }: PipelineBreakdownCardProps) => (
  <Card className="p-6 md:col-span-2">
    <SectionHead
      icon={TrendingUp}
      title="Pipeline Breakdown"
      subtitle="Distribution of deals across stages"
    />
    {stages.length === 0 ? (
      <EmptyState icon={TrendingUp} text="No active pipeline data." />
    ) : (
      <div className="space-y-3">
        {stages.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-[var(--zoru-radius)] bg-zoru-surface-2 px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[13px] font-medium leading-tight text-zoru-ink">
                {item.stage}
              </p>
              <p className="text-[11.5px] text-zoru-ink-muted">{item.count} deals</p>
            </div>
            <div className="text-[14px] font-semibold text-zoru-ink">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD',
              }).format(item.value)}
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

interface RecentContactsCardProps {
  contacts: any[];
}

export const RecentContactsCard = ({ contacts }: RecentContactsCardProps) => (
  <Card className="p-6">
    <SectionHead
      icon={UserPlus}
      title="Recent Contacts"
      subtitle="New leads added to CRM"
    />
    {contacts.length === 0 ? (
      <EmptyState icon={Users} text="No contacts found." />
    ) : (
      <div className="space-y-3">
        {contacts.map((contact) => (
          <div key={contact._id} className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-zoru-line">
              <ZoruAvatarImage src={contact.avatarUrl} alt={contact.name} />
              <ZoruAvatarFallback className="bg-zoru-surface-2 text-[12px] text-zoru-ink">
                {contact.name?.charAt(0) ?? '?'}
              </ZoruAvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-zoru-ink">
                {contact.name}
              </p>
              <p className="truncate text-[11.5px] text-zoru-ink-muted">{contact.email}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

interface InvoiceStatsCardProps {
  stats: { overdueCount: number; overdueAmount: number; sentCount: number; sentAmount: number };
  currency: string;
}

export const InvoiceSummaryCard = ({ stats, currency }: InvoiceStatsCardProps) => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);

  return (
    <Card className="p-6">
      <SectionHead
        icon={FileText}
        title="Invoices"
        subtitle="Overview of pending payments"
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-zoru-danger-ink">Overdue</p>
            <p className="mt-0.5 text-[22px] font-semibold leading-none text-zoru-danger-ink">
              {fmt(stats.overdueAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-zoru-ink-muted">Invoices</p>
            <p className="text-[15px] font-semibold text-zoru-ink">{stats.overdueCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-zoru-ink">Sent (Due)</p>
            <p className="mt-0.5 text-[22px] font-semibold leading-none text-zoru-ink">
              {fmt(stats.sentAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-zoru-ink-muted">Invoices</p>
            <p className="text-[15px] font-semibold text-zoru-ink">{stats.sentCount}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
