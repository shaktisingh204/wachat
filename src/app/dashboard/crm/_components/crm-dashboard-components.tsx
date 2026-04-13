'use client';

import { ClayCard, ClayBadge } from '@/components/clay';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
        <Icon className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold leading-tight text-clay-ink">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">{subtitle}</p>
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
    <div className="flex flex-col items-center justify-center rounded-clay-md bg-clay-surface-2 p-10 text-center">
      <Icon className="mb-3 h-10 w-10 text-clay-ink-fade" strokeWidth={1.5} />
      <p className="text-[13px] text-clay-ink-muted">{text}</p>
    </div>
  );
}

interface RecentDealsCardProps {
  deals: any[];
  currency: string;
}

export const RecentDealsCard = ({ deals, currency }: RecentDealsCardProps) => (
  <ClayCard className="md:col-span-2">
    <SectionHead
      icon={Handshake}
      title="Recent Deals"
      subtitle="Latest deals created in your pipeline"
    />
    {deals.length === 0 ? (
      <EmptyState icon={Handshake} text="No recent deals found." />
    ) : (
      <Table>
        <TableHeader>
          <TableRow className="border-clay-border hover:bg-transparent">
            <TableHead className="text-clay-ink-muted">Deal Name</TableHead>
            <TableHead className="text-clay-ink-muted">Stage</TableHead>
            <TableHead className="text-right text-clay-ink-muted">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal._id} className="border-clay-border">
              <TableCell className="font-medium text-clay-ink">{deal.name}</TableCell>
              <TableCell>
                <ClayBadge tone="rose-soft">{deal.stage}</ClayBadge>
              </TableCell>
              <TableCell className="text-right font-medium text-clay-ink">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: deal.currency || currency || 'USD',
                }).format(deal.value || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </ClayCard>
);

interface UpcomingTasksCardProps {
  tasks: any[];
}

export const UpcomingTasksCard = ({ tasks }: UpcomingTasksCardProps) => (
  <ClayCard>
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
              className="flex items-start justify-between gap-3 border-b border-clay-border pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium leading-tight text-clay-ink">
                  {task.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-clay-ink-muted">
                  <ClayBadge tone={task.priority === 'High' ? 'red' : 'neutral'} dot>
                    {task.priority || 'Normal'}
                  </ClayBadge>
                  {task.dueDate && (
                    <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clay-rose-soft">
                {task.type === 'Call' ? (
                  <Users className="h-3 w-3 text-clay-rose-ink" strokeWidth={1.75} />
                ) : (
                  <FileText className="h-3 w-3 text-clay-rose-ink" strokeWidth={1.75} />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    )}
  </ClayCard>
);

interface PipelineBreakdownCardProps {
  stages: { stage: string; count: number; value: number }[];
  currency: string;
}

export const PipelineBreakdownCard = ({ stages, currency }: PipelineBreakdownCardProps) => (
  <ClayCard className="md:col-span-2">
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
            className="flex items-center gap-4 rounded-clay-md bg-clay-surface-2 px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[13px] font-medium leading-tight text-clay-ink">
                {item.stage}
              </p>
              <p className="text-[11.5px] text-clay-ink-muted">{item.count} deals</p>
            </div>
            <div className="text-[14px] font-semibold text-clay-ink">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD',
              }).format(item.value)}
            </div>
          </div>
        ))}
      </div>
    )}
  </ClayCard>
);

interface RecentContactsCardProps {
  contacts: any[];
}

export const RecentContactsCard = ({ contacts }: RecentContactsCardProps) => (
  <ClayCard>
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
            <Avatar className="h-9 w-9 border border-clay-border">
              <AvatarImage src={contact.avatarUrl} alt={contact.name} />
              <AvatarFallback className="bg-clay-rose-soft text-[12px] text-clay-rose-ink">
                {contact.name?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-clay-ink">
                {contact.name}
              </p>
              <p className="truncate text-[11.5px] text-clay-ink-muted">{contact.email}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </ClayCard>
);

interface InvoiceStatsCardProps {
  stats: { overdueCount: number; overdueAmount: number; sentCount: number; sentAmount: number };
  currency: string;
}

export const InvoiceSummaryCard = ({ stats, currency }: InvoiceStatsCardProps) => {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);

  return (
    <ClayCard>
      <SectionHead
        icon={FileText}
        title="Invoices"
        subtitle="Overview of pending payments"
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-clay-md border border-clay-red-soft bg-clay-red-soft/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-clay-red">Overdue</p>
            <p className="mt-0.5 text-[22px] font-semibold leading-none text-clay-red">
              {fmt(stats.overdueAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-clay-ink-muted">Invoices</p>
            <p className="text-[15px] font-semibold text-clay-ink">{stats.overdueCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-clay-md border border-clay-blue-soft bg-clay-blue-soft/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-clay-blue">Sent (Due)</p>
            <p className="mt-0.5 text-[22px] font-semibold leading-none text-clay-blue">
              {fmt(stats.sentAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-clay-ink-muted">Invoices</p>
            <p className="text-[15px] font-semibold text-clay-ink">{stats.sentCount}</p>
          </div>
        </div>
      </div>
    </ClayCard>
  );
};
