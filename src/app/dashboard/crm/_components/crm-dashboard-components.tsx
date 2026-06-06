'use client';

import { Avatar, AvatarFallback, AvatarImage, Badge, Card, ScrollArea, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
        <Icon className="h-4 w-4 text-[var(--st-text)]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] leading-tight text-[var(--st-text)]">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">{subtitle}</p>
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
    <div className="flex flex-col items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-10 text-center">
      <Icon className="mb-3 h-10 w-10 text-[var(--st-text-secondary)]/70" strokeWidth={1.5} />
      <p className="text-[13px] text-[var(--st-text-secondary)]">{text}</p>
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
        <THead>
          <Tr>
            <Th>Deal Name</Th>
            <Th>Stage</Th>
            <Th className="text-right">Value</Th>
          </Tr>
        </THead>
        <TBody>
          {deals.map((deal) => (
            <Tr key={deal._id}>
              <Td className="font-medium text-[var(--st-text)]">{deal.name}</Td>
              <Td>
                <Badge variant="ghost">{deal.stage}</Badge>
              </Td>
              <Td className="text-right font-medium text-[var(--st-text)]">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: deal.currency || currency || 'USD',
                }).format(deal.value || 0)}
              </Td>
            </Tr>
          ))}
        </TBody>
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
              className="flex items-start justify-between gap-3 border-b border-[var(--st-border)] pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium leading-tight text-[var(--st-text)]">
                  {task.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                  <Badge variant={task.priority === 'High' ? 'danger' : 'ghost'}>
                    {task.priority || 'Normal'}
                  </Badge>
                  {task.dueDate && (
                    <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)]">
                {task.type === 'Call' ? (
                  <Users className="h-3 w-3 text-[var(--st-text)]" strokeWidth={1.75} />
                ) : (
                  <FileText className="h-3 w-3 text-[var(--st-text)]" strokeWidth={1.75} />
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
            className="flex items-center gap-4 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[13px] font-medium leading-tight text-[var(--st-text)]">
                {item.stage}
              </p>
              <p className="text-[11.5px] text-[var(--st-text-secondary)]">{item.count} deals</p>
            </div>
            <div className="text-[14px] font-semibold text-[var(--st-text)]">
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
            <Avatar className="h-9 w-9 border border-[var(--st-border)]">
              <AvatarImage src={contact.avatarUrl} alt={contact.name} />
              <AvatarFallback className="bg-[var(--st-bg-muted)] text-[12px] text-[var(--st-text)]">
                {contact.name?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-[var(--st-text)]">
                {contact.name}
              </p>
              <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">{contact.email}</p>
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
        <div className="flex items-center justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--st-danger)]">Overdue</p>
            <p className="mt-0.5 text-[22px] font-semibold leading-none text-[var(--st-danger)]">
              {fmt(stats.overdueAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[var(--st-text-secondary)]">Invoices</p>
            <p className="text-[15px] font-semibold text-[var(--st-text)]">{stats.overdueCount}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--st-text)]">Sent (Due)</p>
            <p className="mt-0.5 text-[22px] font-semibold leading-none text-[var(--st-text)]">
              {fmt(stats.sentAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[var(--st-text-secondary)]">Invoices</p>
            <p className="text-[15px] font-semibold text-[var(--st-text)]">{stats.sentCount}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
