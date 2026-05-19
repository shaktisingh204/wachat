'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mail, Inbox, Ticket, ArrowUpRight } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSwitch,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ModuleConnectionWizard,
  type ModuleWizardStep,
} from '@/components/crm/module-connection-wizard';

type TicketEmailDraft = {
  inboxAddress: string;
  autoCreateTicket: boolean;
  defaultCategory: string;
  defaultAssignee: string;
};

const DEFAULT_DRAFT: TicketEmailDraft = {
  inboxAddress: '',
  autoCreateTicket: true,
  defaultCategory: '',
  defaultAssignee: '',
};

export default function TicketEmailPage() {
  const steps = React.useMemo<ModuleWizardStep<TicketEmailDraft>[]>(
    () => [
      {
        id: 'intro',
        title: 'Welcome',
        description:
          'Forward customer emails to an inbox in the Email module and we’ll turn each new conversation into a CRM ticket.',
        render: () => (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Inbox, title: '1. Email arrives', body: 'A customer emails your support address.' },
              { icon: Mail, title: '2. Routed by Email module', body: 'The SabNode Email module receives, deduplicates, and threads it.' },
              { icon: Ticket, title: '3. CRM ticket opens', body: 'A ticket is created with sender, subject, and the message body.' },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4"
              >
                <p.icon className="h-5 w-5 text-zoru-ink" />
                <p className="mt-2 text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-zoru-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'inbox',
        title: 'Inbox address',
        description:
          'The address customers email. It must already be receiving in the Email module.',
        render: ({ draft, setDraft }) => (
          <div className="space-y-3">
            <div>
              <ZoruLabel htmlFor="inboxAddress">Inbox address</ZoruLabel>
              <ZoruInput
                id="inboxAddress"
                type="email"
                value={draft.inboxAddress}
                onChange={(e) => setDraft({ inboxAddress: e.target.value })}
                placeholder="support@acme.com"
              />
            </div>
            <label className="flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
              <ZoruSwitch
                checked={draft.autoCreateTicket}
                onCheckedChange={(v) => setDraft({ autoCreateTicket: v })}
                className="mt-1"
              />
              <div>
                <ZoruLabel className="text-sm">Auto-create ticket</ZoruLabel>
                <p className="text-xs text-zoru-ink-muted">
                  Off = emails appear in the inbox only, no ticket is created.
                </p>
              </div>
            </label>
          </div>
        ),
        validate: (d) => {
          if (!d.inboxAddress || !/^.+@.+\..+$/.test(d.inboxAddress)) {
            return 'A valid inbox address is required.';
          }
          return null;
        },
      },
      {
        id: 'defaults',
        title: 'Ticket defaults',
        description: 'Optional defaults applied to incoming tickets.',
        render: ({ draft, setDraft }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="defaultCategory">Default category</ZoruLabel>
              <ZoruInput
                id="defaultCategory"
                value={draft.defaultCategory}
                onChange={(e) => setDraft({ defaultCategory: e.target.value })}
                placeholder="Support"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="defaultAssignee">Default assignee email</ZoruLabel>
              <ZoruInput
                id="defaultAssignee"
                type="email"
                value={draft.defaultAssignee}
                onChange={(e) => setDraft({ defaultAssignee: e.target.value })}
                placeholder="ops@acme.com"
              />
            </div>
          </div>
        ),
      },
      {
        id: 'review',
        title: 'Review',
        render: ({ draft }) => (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zoru-ink-muted">Inbox</dt>
              <dd className="mt-0.5 font-medium">{draft.inboxAddress}</dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Auto-create ticket</dt>
              <dd className="mt-0.5 font-medium">
                {draft.autoCreateTicket ? 'On' : 'Off'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Default category</dt>
              <dd className="mt-0.5 font-medium">
                {draft.defaultCategory || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Default assignee</dt>
              <dd className="mt-0.5 font-medium">
                {draft.defaultAssignee || '—'}
              </dd>
            </div>
          </dl>
        ),
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="Ticket email"
      subtitle="Turn incoming emails into CRM tickets via the Email module inbox."
    >
      <ModuleConnectionWizard<TicketEmailDraft>
        moduleKey="ticket-email"
        title="Ticket email"
        subtitle="Convert customer emails into CRM tickets automatically."
        icon={Ticket}
        targetModuleLabel="Email module"
        defaultDraft={DEFAULT_DRAFT}
        steps={steps}
        manageView={({ connection, onReconnect }) => (
          <ZoruCard>
            <ZoruCardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zoru-ink-muted">Inbox</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.inboxAddress}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Auto-create ticket</p>
                  <ZoruBadge
                    variant={
                      connection.config.autoCreateTicket ? 'default' : 'outline'
                    }
                  >
                    {connection.config.autoCreateTicket ? 'On' : 'Off'}
                  </ZoruBadge>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Default category</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.defaultCategory || '—'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <ZoruButton variant="outline" asChild>
                  <Link href="/dashboard/email/inbox">
                    Open Email inbox
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </ZoruButton>
                <ZoruButton variant="ghost" onClick={onReconnect}>
                  Edit
                </ZoruButton>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        )}
      />
    </EntityListShell>
  );
}
