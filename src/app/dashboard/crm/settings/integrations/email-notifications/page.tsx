'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell,
  Mail,
  ArrowUpRight,
  FileText,
  Receipt,
  Ticket,
  UserPlus,
  CalendarClock,
} from 'lucide-react';

import {
  Button,
  Card,
  ZoruCardContent,
  Switch,
  Badge,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ModuleConnectionWizard,
  type ModuleWizardStep,
} from '@/components/crm/module-connection-wizard';

type EventKey =
  | 'invoice.created'
  | 'invoice.paid'
  | 'quote.sent'
  | 'lead.assigned'
  | 'ticket.replied'
  | 'task.due';

const EVENT_CATALOG: { key: EventKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'invoice.created', label: 'Invoice created', icon: Receipt },
  { key: 'invoice.paid', label: 'Invoice paid', icon: Receipt },
  { key: 'quote.sent', label: 'Quote sent', icon: FileText },
  { key: 'lead.assigned', label: 'Lead assigned', icon: UserPlus },
  { key: 'ticket.replied', label: 'Ticket replied', icon: Ticket },
  { key: 'task.due', label: 'Task due', icon: CalendarClock },
];

type NotifDraft = {
  events: Record<EventKey, boolean>;
};

const DEFAULT_DRAFT: NotifDraft = {
  events: {
    'invoice.created': true,
    'invoice.paid': true,
    'quote.sent': true,
    'lead.assigned': true,
    'ticket.replied': false,
    'task.due': false,
  },
};

export default function EmailNotificationsPage() {
  const steps = React.useMemo<ModuleWizardStep<NotifDraft>[]>(
    () => [
      {
        id: 'intro',
        title: 'Welcome',
        description:
          'CRM events fire transactional emails through the SabNode Email module. Pick which events should trigger emails.',
        render: () => (
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 text-sm text-zoru-ink-muted">
            Templates and sender identity come from the Email module. Click any
            event in the next step to enable/disable it.
          </div>
        ),
      },
      {
        id: 'events',
        title: 'Choose events',
        description:
          'Toggle the events that should send an email when they happen.',
        render: ({ draft, setDraft }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EVENT_CATALOG.map((ev) => {
              const on = draft.events[ev.key];
              return (
                <label
                  key={ev.key}
                  className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3 cursor-pointer"
                >
                  <ev.icon className="h-4 w-4 text-zoru-ink-muted" />
                  <span className="flex-1 text-sm">{ev.label}</span>
                  <ZoruSwitch
                    checked={on}
                    onCheckedChange={(v) =>
                      setDraft({
                        events: { ...draft.events, [ev.key]: v },
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        ),
      },
      {
        id: 'review',
        title: 'Review',
        render: ({ draft }) => {
          const on = EVENT_CATALOG.filter((e) => draft.events[e.key]);
          return (
            <div className="space-y-3">
              <p className="text-sm text-zoru-ink-muted">
                {on.length} of {EVENT_CATALOG.length} events will fire emails.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {on.map((e) => (
                  <ZoruBadge key={e.key} variant="outline">
                    {e.label}
                  </ZoruBadge>
                ))}
              </div>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="Email notifications"
      subtitle="CRM event → email via the SabNode Email module."
    >
      <ModuleConnectionWizard<NotifDraft>
        moduleKey="email-notifications"
        title="Email notifications"
        subtitle="Pick which CRM events should send transactional emails."
        icon={Bell}
        targetModuleLabel="Email module"
        defaultDraft={DEFAULT_DRAFT}
        steps={steps}
        manageView={({ connection, onReconnect }) => {
          const events = (connection.config.events ?? {}) as Record<
            EventKey,
            boolean
          >;
          const on = EVENT_CATALOG.filter((e) => events[e.key]);
          return (
            <ZoruCard>
              <ZoruCardContent className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-zoru-ink-muted">
                    Enabled events
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {on.length === 0 ? (
                      <span className="text-sm text-zoru-ink-muted">None</span>
                    ) : (
                      on.map((e) => (
                        <ZoruBadge key={e.key} variant="outline">
                          <e.icon className="h-3 w-3" />
                          {e.label}
                        </ZoruBadge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <ZoruButton variant="outline" asChild>
                    <Link href="/dashboard/email/templates">
                      <Mail className="h-4 w-4" />
                      Edit templates
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </ZoruButton>
                  <ZoruButton variant="ghost" onClick={onReconnect}>
                    Edit
                  </ZoruButton>
                </div>
              </ZoruCardContent>
            </ZoruCard>
          );
        }}
      />
    </EntityListShell>
  );
}
