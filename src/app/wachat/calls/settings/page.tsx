'use client';

import { Badge, Button, Card, EmptyState, IconButton } from '@/components/sabcrm/20ui';
import { useToast } from '@/hooks/use-toast';
import {
  useState,
  useEffect,
  useTransition,
  useCallback,
  useMemo } from 'react';
import {
  Phone,
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Loader2,
  Trash2,
  } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { getProjectById } from '@/app/actions/index.ts';
import type { PhoneNumber } from '@/lib/definitions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { CallingSettingsForm } from '@/app/wachat/_components/calling-settings-form';
import { useProject } from '@/context/project-context';

/**
 * Wachat Calls — Setup tab (20ui).
 *
 * Phone picker, status banner, calling settings form, and live API call
 * log tracking every fetch/save.
 */

import * as React from 'react';

import {
  recordApiCall,
  clearApiLog,
  subscribeApiLog,
  getApiLog,
  type ApiLogEntry,
} from '@/lib/calls/api-log';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const CRUMBS = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Calls', href: '/wachat/calls' },
  { label: 'Settings' },
];

function useApiLog() {
  const [log, setLog] = useState<ApiLogEntry[]>(getApiLog());
  useEffect(() => subscribeApiLog((next) => setLog([...next])), []);
  return log;
}

/* ── Setup page ─────────────────────────────────────────────────── */

export default function CallingSettingsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isLoading, startLoadingTransition] = useTransition();
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const log = useApiLog();

  const selectedPhone: PhoneNumber | null = useMemo(() => {
    if (!activeProject?.phoneNumbers) return null;
    return (
      activeProject.phoneNumbers.find((p) => p.id === selectedPhoneId) ||
      activeProject.phoneNumbers[0] ||
      null
    );
  }, [activeProject, selectedPhoneId]);

  const refreshProject = useCallback(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      try {
        await getProjectById(activeProjectId);
        recordApiCall({
          method: 'GET',
          status: 'SUCCESS',
          summary: 'Reloaded project',
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        recordApiCall({
          method: 'GET',
          status: 'ERROR',
          summary: 'Project reload failed',
          errorMessage: message,
        });
      }
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProject?.phoneNumbers?.[0]?.id && !selectedPhoneId) {
      setSelectedPhoneId(activeProject.phoneNumbers[0].id);
    }
  }, [activeProject, selectedPhoneId]);

  if (!activeProject) {
    return (
      <WachatPage
        breadcrumb={CRUMBS}
        title="Calling settings"
        description="Configure WhatsApp calling for your phone numbers."
        width="wide"
      >
        <EmptyState
          icon={Phone}
          title="No project selected"
          description="Select a project from the home screen to configure its WhatsApp calling settings."
        />
      </WachatPage>
    );
  }

  const phoneNumbers = activeProject.phoneNumbers ?? [];

  return (
    <WachatPage
      breadcrumb={CRUMBS}
      title="Calling settings"
      description="Configure WhatsApp calling for your phone numbers."
      width="wide"
    >
      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Left column: picker + status banner + form */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {phoneNumbers.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No phone numbers linked"
              description="Add a WhatsApp Business phone number to the project first, then come back here to configure calling."
              action={
                <Button
                  variant="primary"
                  onClick={() => (window.location.href = '/wachat/numbers')}
                >
                  Manage numbers
                </Button>
              }
            />
          ) : (
            <>
              {/* Phone picker card */}
              <Card>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[16px]" style={{ color: 'var(--st-text)' }}>
                      Configure number
                    </h2>
                    <p
                      className="mt-1 text-[12.5px]"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
                      Select a phone number to view and modify its calling
                      configuration.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={isLoading ? undefined : RefreshCw}
                    onClick={refreshProject}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={14} aria-hidden="true" />
                    ) : null}
                    Reload
                  </Button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {phoneNumbers.map((phone) => {
                    const active = phone.id === selectedPhone?.id;
                    const callingEnabled =
                      phone.callingSettings?.status === 'ENABLED';
                    return (
                      <button
                        key={phone.id}
                        type="button"
                        onClick={() => setSelectedPhoneId(phone.id)}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none"
                        style={{
                          borderRadius: 'var(--st-radius)',
                          border: '1px solid',
                          borderColor: active ? 'var(--st-text)' : 'var(--st-border)',
                          background: active
                            ? 'var(--st-bg-secondary)'
                            : 'var(--st-bg)',
                        }}
                      >
                        <div className="min-w-0">
                          <div
                            className="truncate text-[13px]"
                            style={{ color: 'var(--st-text)' }}
                          >
                            {phone.display_phone_number}
                          </div>
                          <div
                            className="truncate text-[11.5px]"
                            style={{ color: 'var(--st-text-secondary)' }}
                          >
                            {phone.verified_name || 'Unverified'}
                          </div>
                        </div>
                        <Badge
                          tone={callingEnabled ? 'success' : 'neutral'}
                          dot
                        >
                          {callingEnabled ? 'On' : 'Off'}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Status banner */}
              {selectedPhone ? <StatusBanner phone={selectedPhone} /> : null}

              {/* Form */}
              {selectedPhone ? (
                <CallingSettingsForm
                  key={selectedPhone.id}
                  project={activeProject}
                  phone={selectedPhone}
                  onSuccess={() => {
                    recordApiCall({
                      method: 'POST',
                      status: 'SUCCESS',
                      summary: `Saved settings for ${selectedPhone.display_phone_number}`,
                    });
                    toast({
                      title: 'Saved',
                      description: 'Calling settings were updated in Meta.',
                    });
                    refreshProject();
                  }}
                />
              ) : (
                <Card padding="lg">
                  <p
                    className="text-center text-[13px]"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Select a phone number above to manage its settings.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right column: API log */}
        <div className="lg:col-span-1">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center"
                  style={{
                    borderRadius: 'var(--st-radius)',
                    background: 'var(--st-bg-secondary)',
                  }}
                >
                  <FileText
                    className="h-4 w-4"
                    style={{ color: 'var(--st-text-secondary)' }}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="text-[13.5px]" style={{ color: 'var(--st-text)' }}>
                    API call log
                  </h3>
                  <p
                    className="text-[11.5px]"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Fetches and saves from this page.
                  </p>
                </div>
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                label="Clear log"
                icon={Trash2}
                onClick={clearApiLog}
                disabled={log.length === 0}
              />
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {log.length === 0 ? (
                <p
                  className="py-8 text-center text-[12.5px]"
                  style={{ color: 'var(--st-text-secondary)' }}
                >
                  Nothing logged yet. Fetches and saves will appear here.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {log.map((entry) => (
                    <li
                      key={entry.id}
                      className="py-2.5"
                      style={{ borderTop: '1px solid var(--st-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[10.5px]"
                          style={{ color: 'var(--st-text-secondary)' }}
                        >
                          {entry.method}
                        </span>
                        <Badge
                          tone={entry.status === 'SUCCESS' ? 'success' : 'danger'}
                        >
                          {entry.status === 'SUCCESS' ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {entry.status}
                        </Badge>
                        <span
                          className="ml-auto text-[10.5px]"
                          style={{ color: 'var(--st-text-secondary)' }}
                        >
                          {formatDistanceToNow(entry.createdAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div
                        className="mt-1 text-[12.5px]"
                        style={{ color: 'var(--st-text)' }}
                      >
                        {entry.summary}
                      </div>
                      {entry.status === 'ERROR' && entry.errorMessage ? (
                        <div
                          className="mt-1 truncate text-[11.5px]"
                          style={{ color: 'var(--st-danger)' }}
                        >
                          {entry.errorMessage}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </WachatPage>
  );
}

/* ── Status banner ──────────────────────────────────────────────── */

function StatusBanner({ phone }: { phone: PhoneNumber }) {
  const s = phone.callingSettings;
  const enabled = s?.status === 'ENABLED';
  const callbackOn = s?.callback_permission_status === 'ENABLED';
  const sipOn = s?.sip?.status === 'ENABLED';
  const hoursOn = s?.call_hours?.status === 'ENABLED';

  const checklist: Array<{ label: string; ok: boolean }> = [
    { label: 'Calling enabled', ok: enabled },
    { label: 'Callback prompt', ok: callbackOn },
    { label: 'Business hours', ok: hoursOn },
    { label: 'SIP routing', ok: sipOn },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[14px]" style={{ color: 'var(--st-text)' }}>
            Current status
          </h3>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: 'var(--st-text-secondary)' }}
          >
            Live configuration for {phone.display_phone_number}
          </p>
        </div>
        <Badge tone={enabled ? 'success' : 'neutral'} dot>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-3 py-2"
            style={{
              borderRadius: 'var(--st-radius)',
              border: '1px solid var(--st-border)',
              background: 'var(--st-bg-secondary)',
            }}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{
                background: item.ok
                  ? 'color-mix(in srgb, var(--st-status-ok) 12%, transparent)'
                  : 'var(--st-bg)',
                color: item.ok ? 'var(--st-status-ok)' : 'var(--st-text-tertiary)',
              }}
            >
              {item.ok ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
              )}
            </span>
            <span
              className="truncate text-[12px]"
              style={{ color: 'var(--st-text)' }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
