'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mail, Send, ShieldCheck, ArrowUpRight, AlertTriangle } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ModuleConnectionWizard,
  type ModuleWizardStep,
} from '@/components/crm/module-connection-wizard';

type SmtpDraft = {
  fromAddress: string;
  fromName: string;
  replyTo: string;
};

const DEFAULT_DRAFT: SmtpDraft = {
  fromAddress: '',
  fromName: '',
  replyTo: '',
};

export default function SmtpIntegrationPage() {
  const steps = React.useMemo<ModuleWizardStep<SmtpDraft>[]>(
    () => [
      {
        id: 'intro',
        title: 'Welcome',
        description:
          'Outbound CRM emails (invoices, quotes, ticket replies) are sent through the SabNode Email module — no separate SMTP credentials needed here.',
        render: () => (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: ShieldCheck, title: 'Already authenticated', body: 'Reuses the SMTP / sender config from your Email module.' },
              { icon: Send, title: 'Single deliverability lane', body: 'Bounces, suppressions, and warmup stay coordinated.' },
              { icon: Mail, title: 'Threaded replies', body: 'Replies arrive in the Email module inbox you already use.' },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4"
              >
                <p.icon className="h-5 w-5 text-zoru-ink" />
                <p className="mt-2 text-sm font-medium text-zoru-ink">
                  {p.title}
                </p>
                <p className="mt-1 text-xs text-zoru-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'identity',
        title: 'Sender identity',
        description:
          'Used as the From: header on CRM emails. Make sure the address is verified inside the Email module.',
        render: ({ draft, setDraft }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="fromName">Display name</ZoruLabel>
              <ZoruInput
                id="fromName"
                value={draft.fromName}
                onChange={(e) => setDraft({ fromName: e.target.value })}
                placeholder="Acme Sales"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="fromAddress">From address</ZoruLabel>
              <ZoruInput
                id="fromAddress"
                type="email"
                value={draft.fromAddress}
                onChange={(e) => setDraft({ fromAddress: e.target.value })}
                placeholder="sales@acme.com"
              />
            </div>
            <div className="md:col-span-2">
              <ZoruLabel htmlFor="replyTo">Reply-to (optional)</ZoruLabel>
              <ZoruInput
                id="replyTo"
                type="email"
                value={draft.replyTo}
                onChange={(e) => setDraft({ replyTo: e.target.value })}
                placeholder="support@acme.com"
              />
            </div>
            <div className="md:col-span-2 flex items-start gap-2 rounded-[var(--zoru-radius)] border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                If this address isn&apos;t verified in the Email module, sends
                will fail. Verify it first under{' '}
                <Link
                  href="/dashboard/email/settings"
                  className="underline font-medium"
                >
                  Email → Settings
                </Link>
                .
              </p>
            </div>
          </div>
        ),
        validate: (d) => {
          if (!d.fromAddress || !/^.+@.+\..+$/.test(d.fromAddress)) {
            return 'A valid From: address is required.';
          }
          return null;
        },
      },
      {
        id: 'review',
        title: 'Review',
        render: ({ draft }) => (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zoru-ink-muted">From</dt>
              <dd className="mt-0.5 font-medium">
                {draft.fromName ? `${draft.fromName} <${draft.fromAddress}>` : draft.fromAddress}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zoru-ink-muted">Reply-to</dt>
              <dd className="mt-0.5 font-medium">{draft.replyTo || '—'}</dd>
            </div>
          </dl>
        ),
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="SMTP"
      subtitle="Route CRM emails through the SabNode Email module."
    >
      <ModuleConnectionWizard<SmtpDraft>
        moduleKey="smtp"
        title="SMTP"
        subtitle="The CRM sends transactional emails via the SabNode Email module."
        icon={Mail}
        targetModuleLabel="Email module"
        defaultDraft={DEFAULT_DRAFT}
        steps={steps}
        manageView={({ connection, onReconnect }) => (
          <ZoruCard>
            <ZoruCardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zoru-ink-muted">From</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.fromName
                      ? `${connection.config.fromName} <${connection.config.fromAddress}>`
                      : connection.config.fromAddress}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Reply-to</p>
                  <p className="mt-0.5 font-medium">
                    {connection.config.replyTo || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Status</p>
                  <ZoruBadge>{connection.status}</ZoruBadge>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <ZoruButton variant="outline" asChild>
                  <Link href="/dashboard/email/settings">
                    Open Email settings
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
