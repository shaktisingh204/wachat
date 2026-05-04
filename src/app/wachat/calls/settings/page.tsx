'use client';

/**
 * Wachat Calls — Setup tab (ZoruUI).
 *
 * Phone picker, status banner, calling settings form, and live API call
 * log tracking every fetch/save.
 */

import * as React from 'react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
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

import { CallingSettingsForm } from '@/components/wabasimplify/calling-settings-form';
import { useProject } from '@/context/project-context';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  recordApiCall,
  clearApiLog,
  subscribeApiLog,
  getApiLog,
  type ApiLogEntry,
} from '@/lib/calls/api-log';

function useApiLog() {
  const [log, setLog] = useState<ApiLogEntry[]>(getApiLog());
  useEffect(() => subscribeApiLog((next) => setLog([...next])), []);
  return log;
}

/* ── Setup page ─────────────────────────────────────────────────── */

export default function CallingSettingsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
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
      <ZoruEmptyState
        icon={<Phone />}
        title="No project selected"
        description="Select a project from the home screen to configure its WhatsApp calling settings."
      />
    );
  }

  const phoneNumbers = activeProject.phoneNumbers ?? [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      {/* Left column: picker + status banner + form */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        {phoneNumbers.length === 0 ? (
          <ZoruEmptyState
            icon={<Phone />}
            title="No phone numbers linked"
            description="Add a WhatsApp Business phone number to the project first, then come back here to configure calling."
            action={
              <ZoruButton
                onClick={() => (window.location.href = '/wachat/numbers')}
              >
                Manage numbers
              </ZoruButton>
            }
          />
        ) : (
          <>
            {/* Phone picker card */}
            <ZoruCard className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[16px] text-zoru-ink">Configure number</h2>
                  <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                    Select a phone number to view and modify its calling
                    configuration.
                  </p>
                </div>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={refreshProject}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  Reload
                </ZoruButton>
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
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-[var(--zoru-radius)] border px-4 py-3 text-left transition-colors focus-visible:outline-none',
                        active
                          ? 'border-zoru-ink bg-zoru-surface-2'
                          : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-zoru-ink">
                          {phone.display_phone_number}
                        </div>
                        <div className="truncate text-[11.5px] text-zoru-ink-muted">
                          {phone.verified_name || 'Unverified'}
                        </div>
                      </div>
                      <ZoruBadge
                        variant={callingEnabled ? 'success' : 'ghost'}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            callingEnabled
                              ? 'bg-zoru-success'
                              : 'bg-zoru-ink-subtle',
                          )}
                        />
                        {callingEnabled ? 'On' : 'Off'}
                      </ZoruBadge>
                    </button>
                  );
                })}
              </div>
            </ZoruCard>

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
              <ZoruCard className="p-8 text-center text-[13px] text-zoru-ink-muted">
                Select a phone number above to manage its settings.
              </ZoruCard>
            )}
          </>
        )}
      </div>

      {/* Right column: API log */}
      <div className="lg:col-span-1">
        <ZoruCard className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2">
                <FileText className="h-4 w-4 text-zoru-ink-muted" />
              </span>
              <div>
                <h3 className="text-[13.5px] text-zoru-ink">API call log</h3>
                <p className="text-[11.5px] text-zoru-ink-muted">
                  Fetches and saves from this page.
                </p>
              </div>
            </div>
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Clear log"
              onClick={clearApiLog}
              disabled={log.length === 0}
            >
              <Trash2 />
            </ZoruButton>
          </div>

          <div className="mt-4 max-h-96 overflow-y-auto">
            {log.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-zoru-ink-muted">
                Nothing logged yet. Fetches and saves will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-zoru-line">
                {log.map((entry) => (
                  <li key={entry.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-zoru-ink-muted">
                        {entry.method}
                      </span>
                      <ZoruBadge
                        variant={
                          entry.status === 'SUCCESS' ? 'success' : 'danger'
                        }
                      >
                        {entry.status === 'SUCCESS' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {entry.status}
                      </ZoruBadge>
                      <span className="ml-auto text-[10.5px] text-zoru-ink-muted">
                        {formatDistanceToNow(entry.createdAt, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] text-zoru-ink">
                      {entry.summary}
                    </div>
                    {entry.status === 'ERROR' && entry.errorMessage ? (
                      <div className="mt-1 truncate text-[11.5px] text-zoru-danger">
                        {entry.errorMessage}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ZoruCard>
      </div>
    </div>
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
    <ZoruCard className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[14px] text-zoru-ink">Current status</h3>
          <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
            Live configuration for {phone.display_phone_number}
          </p>
        </div>
        <ZoruBadge variant={enabled ? 'success' : 'ghost'}>
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              enabled ? 'bg-zoru-success' : 'bg-zoru-ink-subtle',
            )}
          />
          {enabled ? 'Enabled' : 'Disabled'}
        </ZoruBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-3 py-2"
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full',
                item.ok
                  ? 'bg-zoru-success/10 text-zoru-success'
                  : 'bg-zoru-surface-2 text-zoru-ink-subtle',
              )}
            >
              {item.ok ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
            </span>
            <span className="truncate text-[12px] text-zoru-ink">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </ZoruCard>
  );
}
