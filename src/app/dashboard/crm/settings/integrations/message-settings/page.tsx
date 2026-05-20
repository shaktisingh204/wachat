'use client';

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
  FileText,
  LoaderCircle,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruSwitch,
} from '@/components/zoruui';
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
  getMessageSetting,
  saveMessageSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsMessageSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsMessageSetting & { _id: unknown }) | null;

export default function MessageSettingsPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [enabled, setEnabled] = useState(false);
  const [allowAttachments, setAllowAttachments] = useState(true);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveMessageSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getMessageSetting() as Promise<Doc>,
        getIntegrationEvents('message-settings', 10),
        getIntegrationStats('message-settings'),
      ]);
      setDoc(d);
      setEnabled(Boolean(d?.messages_enabled));
      setAllowAttachments(d?.allow_attachments !== false);
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('message-settings', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('message-settings', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsMessageSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const docId = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const state: ConnectionState = enabled
    ? stats?.lastErrorMessage
      ? 'error'
      : 'connected'
    : 'disconnected';

  // Template count is derived from the most recent `templates` event.
  const totalTemplates = useMemo(() => {
    const tpl = events.find(
      (e) => e.kind === 'templates' && e.status === 'success',
    );
    return tpl?.count ?? 0;
  }, [events]);

  // Top template — pulled from event.meta.topTemplate when present.
  const topTemplate = useMemo(() => {
    const tpl = events.find(
      (e) =>
        e.kind === 'templates' &&
        e.status === 'success' &&
        typeof (e.meta as any)?.topTemplate === 'string',
    );
    return (tpl?.meta as any)?.topTemplate ?? '—';
  }, [events]);

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('message-settings');
      reportResult('message-settings', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('message-settings');
      reportResult('message-settings', res);
      setEnabled(false);
      refresh();
    });
  };

  return (
    <EntityListShell
      title="Message settings"
      subtitle="In-app & template-driven messaging defaults for the CRM."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Message settings"
          description="Controls in-app messaging, attachment limits and template routing."
          icon={MessageSquare}
          state={state}
          connectedAs={enabled ? 'Messages enabled' : 'Messages disabled'}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={[
            ...(allowAttachments ? ['attachments'] : []),
            ...(doc?.max_file_size_mb
              ? [`max ${doc.max_file_size_mb} MB`]
              : []),
          ]}
          onTest={enabled ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Templates',
              value: totalTemplates,
              period: 'Available CRM templates',
              icon: <FileText />,
            },
            {
              label: 'Sent today',
              value: stats?.deliveriesToday ?? 0,
              period: `${stats?.deliveriesThisMonth ?? 0} this month`,
              icon: <Send />,
            },
            {
              label: 'Failed today',
              value: stats?.failuresToday ?? 0,
              period: stats?.failuresToday
                ? 'Investigate activity log'
                : 'All clean',
              icon: <XCircle />,
              invertDelta: true,
              delta: stats?.failuresToday ?? 0,
            },
            {
              label: 'Top template',
              value: topTemplate,
              period: 'Most-used template',
              icon: <MessageSquare />,
            },
          ]}
        />

        <IntegrationSection
          title="Messaging policy"
          description="Enable in-app messaging, attachments and the max file size."
        >
          {!doc && !docId ? (
            <div className="space-y-4">
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {docId ? <input type="hidden" name="_id" value={docId} /> : null}
            <input
              type="hidden"
              name="messages_enabled"
              value={enabled ? 'true' : 'false'}
            />
            <input
              type="hidden"
              name="allow_attachments"
              value={allowAttachments ? 'true' : 'false'}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
                <div>
                  <div className="text-[13px] text-zoru-ink">
                    Messages enabled
                  </div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    Enable in-app messaging across the CRM.
                  </div>
                </div>
                <ZoruSwitch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  aria-label="Messages enabled"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
                <div>
                  <div className="text-[13px] text-zoru-ink">
                    Allow attachments
                  </div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    Users can attach files to messages.
                  </div>
                </div>
                <ZoruSwitch
                  checked={allowAttachments}
                  onCheckedChange={setAllowAttachments}
                  aria-label="Allow attachments"
                />
              </div>

              <div>
                <ZoruLabel htmlFor="max_file_size_mb">
                  Max file size (MB)
                </ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="max_file_size_mb"
                    name="max_file_size_mb"
                    type="number"
                    min={1}
                    max={1024}
                    defaultValue={v('max_file_size_mb') || '25'}
                    disabled={!allowAttachments}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
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
          title="Message activity"
          description="Deliveries, template renders and policy events."
          events={events}
          emptyMessage="No message activity yet."
        />
      </div>
    </EntityListShell>
  );
}
