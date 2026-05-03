'use client';

/**
 * Wachat Calls -- Setup tab.
 *
 * Select a phone number, view a status summary, edit Meta calling settings
 * (status, icon visibility, country restriction, callback prompt, business
 * hours, SIP), and see a live API call log tracking every fetch/save.
 */

import * as React from 'react';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
  LuPhone,
  LuCircleAlert,
  LuCircleCheck,
  LuFileText,
  LuRefreshCw,
  LuLoader,
  LuTrash2,
} from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';

import { getProjectById } from '@/app/actions/index.ts';
import type { PhoneNumber } from '@/lib/definitions';

import { CallingSettingsForm } from '@/components/wabasimplify/calling-settings-form';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayButton, ClayCard } from '@/components/clay';
import { cn } from '@/lib/utils';
import { recordApiCall, clearApiLog, subscribeApiLog, getApiLog, type ApiLogEntry } from '@/lib/calls/api-log';

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
        recordApiCall({ method: 'GET', status: 'SUCCESS', summary: 'Reloaded project' });
      } catch (err: any) {
        recordApiCall({
          method: 'GET',
          status: 'ERROR',
          summary: 'Project reload failed',
          errorMessage: err?.message || String(err),
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
      <ClayCard className="p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LuPhone className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-foreground">No project selected</h2>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[12.5px] text-muted-foreground">
          Select a project from the home screen to configure its WhatsApp calling settings.
        </p>
      </ClayCard>
    );
  }

  const phoneNumbers = activeProject.phoneNumbers ?? [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      {/* Left column: picker + status banner + form */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        {phoneNumbers.length === 0 ? (
          <ClayCard className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LuPhone className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-[16px] font-semibold text-foreground">No phone numbers linked</h2>
            <p className="mx-auto mt-1.5 max-w-[360px] text-[12.5px] text-muted-foreground">
              Add a WhatsApp Business phone number to the project first, then come back here to configure calling.
            </p>
            <ClayButton
              variant="obsidian"
              size="md"
              className="mt-4"
              onClick={() => (window.location.href = '/dashboard/numbers')}
            >
              Manage numbers
            </ClayButton>
          </ClayCard>
        ) : (
          <>
            {/* Phone picker card */}
            <ClayCard padded={false} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-foreground">Configure number</h2>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Select a phone number to view and modify its calling configuration.
                  </p>
                </div>
                <ClayButton
                  variant="ghost"
                  size="sm"
                  leading={
                    isLoading ? (
                      <LuLoader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                    )
                  }
                  onClick={refreshProject}
                  disabled={isLoading}
                >
                  Reload
                </ClayButton>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {phoneNumbers.map((phone) => {
                  const active = phone.id === selectedPhone?.id;
                  const callingEnabled = phone.callingSettings?.status === 'ENABLED';
                  return (
                    <button
                      key={phone.id}
                      type="button"
                      onClick={() => setSelectedPhoneId(phone.id)}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors',
                        active
                          ? 'border-foreground bg-foreground/5 shadow-sm'
                          : 'border-border bg-card hover:border-border',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-foreground">
                          {phone.display_phone_number}
                        </div>
                        <div className="truncate text-[11.5px] text-muted-foreground">
                          {phone.verified_name || 'Unverified'}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                          callingEnabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            callingEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/70',
                          )}
                        />
                        {callingEnabled ? 'On' : 'Off'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ClayCard>

            {/* Status banner */}
            {selectedPhone ? (
              <StatusBanner phone={selectedPhone} />
            ) : null}

            {/* Form */}
            {selectedPhone ? (
              <CallingSettingsForm
                key={selectedPhone.id}
                project={activeProject}
                phone={selectedPhone}
                onSuccess={() => {
                  recordApiCall({ method: 'POST', status: 'SUCCESS', summary: `Saved settings for ${selectedPhone.display_phone_number}` });
                  toast({ title: 'Saved', description: 'Calling settings were updated in Meta.' });
                  refreshProject();
                }}
              />
            ) : (
              <ClayCard className="p-8 text-center text-[13px] text-muted-foreground">
                Select a phone number above to manage its settings.
              </ClayCard>
            )}
          </>
        )}
      </div>

      {/* Right column: API log */}
      <div className="lg:col-span-1">
        <ClayCard padded={false} className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-secondary">
                <LuFileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-[13.5px] font-semibold text-foreground">API call log</h3>
                <p className="text-[11.5px] text-muted-foreground">Fetches and saves from this page.</p>
              </div>
            </div>
            <ClayButton
              variant="ghost"
              size="icon"
              aria-label="Clear log"
              onClick={clearApiLog}
              disabled={log.length === 0}
              className="h-7 w-7"
            >
              <LuTrash2 className="h-3.5 w-3.5" />
            </ClayButton>
          </div>

          <div className="mt-4 max-h-96 overflow-y-auto">
            {log.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-muted-foreground">
                Nothing logged yet. Fetches and saves will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {log.map((entry) => (
                  <li key={entry.id} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{entry.method}</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          entry.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700',
                        )}
                      >
                        {entry.status === 'SUCCESS' ? (
                          <LuCircleCheck className="h-3 w-3" strokeWidth={2} />
                        ) : (
                          <LuCircleAlert className="h-3 w-3" strokeWidth={2} />
                        )}
                        {entry.status}
                      </span>
                      <span className="ml-auto text-[10.5px] text-muted-foreground">
                        {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] text-foreground">{entry.summary}</div>
                    {entry.status === 'ERROR' && entry.errorMessage ? (
                      <div className="mt-1 truncate text-[11.5px] text-rose-600">{entry.errorMessage}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ClayCard>
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
    <ClayCard padded={false} className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Current status</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Live configuration for {phone.display_phone_number}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide',
            enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              enabled ? 'bg-emerald-500' : 'bg-muted-foreground/70',
            )}
          />
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-[10px] border border-border bg-secondary px-3 py-2"
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full',
                item.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground/70',
              )}
            >
              {item.ok ? (
                <LuCircleCheck className="h-3 w-3" strokeWidth={2.25} />
              ) : (
                <LuCircleAlert className="h-3 w-3" strokeWidth={2.25} />
              )}
            </span>
            <span className="truncate text-[12px] font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </ClayCard>
  );
}
