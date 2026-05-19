'use client';

import * as React from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowUpRight, Send, Bell, Receipt } from 'lucide-react';

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

type TriggerKey =
  | 'invoice.created'
  | 'invoice.paid'
  | 'quote.sent'
  | 'appointment.reminder'
  | 'otp.send';

const TRIGGER_CATALOG: { key: TriggerKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'invoice.created', label: 'Invoice created', icon: Receipt },
  { key: 'invoice.paid', label: 'Invoice paid', icon: Receipt },
  { key: 'quote.sent', label: 'Quote sent', icon: Send },
  { key: 'appointment.reminder', label: 'Appointment reminder', icon: Bell },
  { key: 'otp.send', label: 'OTP', icon: MessageSquare },
];

type MsgDraft = {
  senderId: string;
  templatePrefix: string;
  triggers: Record<TriggerKey, boolean>;
};

const DEFAULT_DRAFT: MsgDraft = {
  senderId: '',
  templatePrefix: '',
  triggers: {
    'invoice.created': true,
    'invoice.paid': true,
    'quote.sent': false,
    'appointment.reminder': true,
    'otp.send': true,
  },
};

export default function MessageSettingsPage() {
  const steps = React.useMemo<ModuleWizardStep<MsgDraft>[]>(
    () => [
      {
        id: 'intro',
        title: 'Welcome',
        description:
          'CRM events fire SMS messages through the SabNode SMS module. The provider, DLT credentials, and templates live there — this page just picks the binding.',
        render: () => (
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 text-sm text-zoru-ink-muted">
            DLT templates and provider config are managed in{' '}
            <Link href="/dashboard/sms/config" className="underline font-medium">
              SMS → Config
            </Link>
            . This wizard only stores the CRM-side preferences.
          </div>
        ),
      },
      {
        id: 'sender',
        title: 'Sender + templates',
        description:
          'Sender ID used for outbound CRM messages and the prefix matched against your DLT templates.',
        render: ({ draft, setDraft }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="senderId">Sender ID</ZoruLabel>
              <ZoruInput
                id="senderId"
                value={draft.senderId}
                onChange={(e) => setDraft({ senderId: e.target.value })}
                placeholder="ACMECRM"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="templatePrefix">Template prefix</ZoruLabel>
              <ZoruInput
                id="templatePrefix"
                value={draft.templatePrefix}
                onChange={(e) => setDraft({ templatePrefix: e.target.value })}
                placeholder="CRM_"
              />
            </div>
          </div>
        ),
        validate: (d) => (d.senderId ? null : 'Sender ID is required.'),
      },
      {
        id: 'triggers',
        title: 'Triggers',
        description: 'Toggle the CRM events that should send an SMS.',
        render: ({ draft, setDraft }) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {TRIGGER_CATALOG.map((t) => {
              const on = draft.triggers[t.key];
              return (
                <label
                  key={t.key}
                  className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3 cursor-pointer"
                >
                  <t.icon className="h-4 w-4 text-zoru-ink-muted" />
                  <span className="flex-1 text-sm">{t.label}</span>
                  <ZoruSwitch
                    checked={on}
                    onCheckedChange={(v) =>
                      setDraft({
                        triggers: { ...draft.triggers, [t.key]: v },
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
          const on = TRIGGER_CATALOG.filter((t) => draft.triggers[t.key]);
          return (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zoru-ink-muted">Sender ID</p>
                  <p className="mt-0.5 font-medium">{draft.senderId}</p>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Template prefix</p>
                  <p className="mt-0.5 font-medium">
                    {draft.templatePrefix || '—'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-zoru-ink-muted">Triggers</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {on.length === 0 ? (
                    <span className="text-zoru-ink-muted">None</span>
                  ) : (
                    on.map((t) => (
                      <ZoruBadge key={t.key} variant="outline">
                        {t.label}
                      </ZoruBadge>
                    ))
                  )}
                </div>
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
      title="Message settings"
      subtitle="Route CRM SMS events through the SabNode SMS module."
    >
      <ModuleConnectionWizard<MsgDraft>
        moduleKey="message-settings"
        title="Message settings"
        subtitle="Outbound CRM SMS dispatched via the SabNode SMS module."
        icon={MessageSquare}
        targetModuleLabel="SMS module"
        defaultDraft={DEFAULT_DRAFT}
        steps={steps}
        manageView={({ connection, onReconnect }) => {
          const triggers = (connection.config.triggers ?? {}) as Record<
            TriggerKey,
            boolean
          >;
          const on = TRIGGER_CATALOG.filter((t) => triggers[t.key]);
          return (
            <ZoruCard>
              <ZoruCardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-zoru-ink-muted">Sender ID</p>
                    <p className="mt-0.5 font-medium">
                      {connection.config.senderId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zoru-ink-muted">
                      Template prefix
                    </p>
                    <p className="mt-0.5 font-medium">
                      {connection.config.templatePrefix || '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zoru-ink-muted">Active triggers</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {on.length === 0 ? (
                      <span className="text-sm text-zoru-ink-muted">None</span>
                    ) : (
                      on.map((t) => (
                        <ZoruBadge key={t.key} variant="outline">
                          <t.icon className="h-3 w-3" />
                          {t.label}
                        </ZoruBadge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <ZoruButton variant="outline" asChild>
                    <Link href="/dashboard/sms/config">
                      Open SMS config
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
