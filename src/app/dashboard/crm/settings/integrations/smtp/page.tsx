'use client';

import {
  Button,
  Input,
  Label,
  Skeleton,
  Switch,
  Card,
  ZoruCardContent,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  Gauge,
  LoaderCircle,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ConnectionHeader,
  IntegrationActivityFeed,
  IntegrationKpiGrid,
  IntegrationSection,
  useIntegrationToast,
  type ConnectionState,
} from '@/components/crm/integration-console';
import {
  getSmtpSetting,
  saveSmtpSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSmtpSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSmtpSetting & { _id: unknown }) | null;

/** Soft daily quota used to surface "remaining" — purely advisory. */
const DAILY_QUOTA = 1000;

export default function SmtpIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [verified, setVerified] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveSmtpSetting,
    { message: '', error: '' } as { message?: string; error?: string; id?: string },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getSmtpSetting() as Promise<Doc>,
        getIntegrationEvents('smtp', 10),
        getIntegrationStats('smtp'),
      ]);
      setDoc(d);
      setVerified(Boolean(d?.verified));
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('smtp', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('smtp', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsSmtpSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const isConfigured = Boolean(doc?.host && doc?.from_email);
  const state: ConnectionState = isConfigured
    ? verified
      ? 'connected'
      : 'disconnected'
    : 'disconnected';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('smtp');
      reportResult('smtp', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('smtp');
      reportResult('smtp', res);
      setVerified(false);
      refresh();
    });
  };

  const sentToday = stats?.deliveriesToday ?? 0;
  const failedToday = stats?.failuresToday ?? 0;
  const quotaRemaining = useMemo(
    () => Math.max(0, DAILY_QUOTA - sentToday),
    [sentToday],
  );

  return (
    <EntityListShell title="SMTP" subtitle="Outbound mail server for CRM emails.">
      <div className="space-y-4">
        <ConnectionHeader
          name="SMTP"
          description="Transactional email delivery via your SMTP server."
          icon={Mail}
          state={state}
          connectedAs={doc?.from_email || null}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={doc?.encryption ? [`${String(doc.encryption).toUpperCase()}`] : []}
          onTest={isConfigured ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Emails sent today',
              value: sentToday,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <Send />,
            },
            {
              label: 'Failed today',
              value: failedToday,
              period: failedToday > 0 ? 'Check the activity log' : 'All good',
              icon: <AlertCircle />,
              invertDelta: true,
              delta: failedToday,
            },
            {
              label: 'Daily quota remaining',
              value: quotaRemaining,
              period: `of ${DAILY_QUOTA.toLocaleString()} / day`,
              icon: <Gauge />,
            },
            {
              label: 'Verified',
              value: verified ? 'Yes' : 'No',
              period: doc?.encryption ? `${String(doc.encryption).toUpperCase()} encryption` : 'No encryption',
              icon: <ShieldCheck />,
            },
          ]}
        />

        <IntegrationSection
          title="Server credentials"
          description="Connection details for your SMTP relay."
        >
          {!doc && !id ? (
            <div className="space-y-4">
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {id ? <input type="hidden" name="_id" value={id} /> : null}
            <input type="hidden" name="verified" value={verified ? 'true' : 'false'} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <ZoruLabel htmlFor="mail_driver">Driver</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="mail_driver" name="mail_driver" defaultValue={v('mail_driver')} placeholder="smtp" />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="encryption">Encryption</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="encryption" name="encryption" defaultValue={v('encryption')} placeholder="tls / ssl / none" />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="host">Host</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="host" name="host" defaultValue={v('host')} placeholder="smtp.example.com" />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="port">Port</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="port" name="port" defaultValue={v('port')} placeholder="587" />
                </div>
              </div>

              <div>
                <ZoruLabel htmlFor="username">Username</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="username" name="username" defaultValue={v('username')} autoComplete="off" />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="password">Password</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="password" name="password" type="password" defaultValue={v('password')} autoComplete="new-password" />
                </div>
              </div>
            </div>
          </form>
        </IntegrationSection>

        <IntegrationSection
          title="Sender identity"
          description="From-header used on outbound CRM emails."
        >
          <form id="smtp-sender-form" action={saveFormAction} className="space-y-4">
            {id ? <input type="hidden" name="_id" value={id} /> : null}
            <input type="hidden" name="verified" value={verified ? 'true' : 'false'} />
            {/* Echo the server credentials so the singleton save doesn't wipe them. */}
            <input type="hidden" name="mail_driver" value={v('mail_driver')} />
            <input type="hidden" name="encryption" value={v('encryption')} />
            <input type="hidden" name="host" value={v('host')} />
            <input type="hidden" name="port" value={v('port')} />
            <input type="hidden" name="username" value={v('username')} />
            <input type="hidden" name="password" value={v('password')} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <ZoruLabel htmlFor="from_name">From name</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="from_name" name="from_name" defaultValue={v('from_name')} placeholder="Acme Sales" />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="from_email">From email</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput id="from_email" name="from_email" type="email" defaultValue={v('from_email')} placeholder="sales@acme.com" />
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
                <div>
                  <div className="text-[13px] text-zoru-ink">Domain verified</div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    Toggle on once the from address is authenticated (SPF / DKIM).
                  </div>
                </div>
                <ZoruSwitch checked={verified} onCheckedChange={setVerified} aria-label="SMTP verified" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </ZoruButton>
            </div>
          </form>
        </IntegrationSection>

        {stats?.lastErrorMessage ? (
          <ZoruCard>
            <ZoruCardContent className="flex items-start gap-3 border-l-2 border-zoru-danger/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-zoru-danger" />
              <div>
                <p className="text-sm font-medium text-zoru-ink">Last error</p>
                <p className="mt-0.5 text-xs text-zoru-ink-muted break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        ) : null}

        <IntegrationActivityFeed
          title="Delivery log"
          description="Recent send attempts."
          events={events}
          emptyMessage="No deliveries yet."
        />
      </div>
    </EntityListShell>
  );
}
