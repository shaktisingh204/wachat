'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  Phone,
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Loader2,
  Trash2,
  Activity,
  Clock,
  Settings as SettingsIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { getProjectById } from '@/app/actions/index.ts';
import type { PhoneNumber } from '@/lib/definitions';
import { CallingSettingsForm } from '@/app/wachat/_components/calling-settings-form';
import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import {
  WaButton,
  Section,
  EmptyState,
  StatusPill,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

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

export default function CallingSettingsPage() {
  const reduce = useReducedMotion();
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isLoading, startLoadingTransition] = useTransition();
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const log = useApiLog();

  const selectedPhone: PhoneNumber | null = useMemo(() => {
    if (!activeProject?.phoneNumbers) return null;
    return activeProject.phoneNumbers.find((p) => p.id === selectedPhoneId) || activeProject.phoneNumbers[0] || null;
  }, [activeProject, selectedPhoneId]);

  const refreshProject = useCallback(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      try {
        await getProjectById(activeProjectId);
        recordApiCall({ method: 'GET', status: 'SUCCESS', summary: 'Reloaded project' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        recordApiCall({ method: 'GET', status: 'ERROR', summary: 'Project reload failed', errorMessage: message });
      }
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProject?.phoneNumbers?.[0]?.id && !selectedPhoneId) {
      setSelectedPhoneId(activeProject.phoneNumbers[0].id);
    }
  }, [activeProject, selectedPhoneId]);

  const apiKpi = useMemo(() => {
    const today = Date.now() - 24 * 60 * 60 * 1000;
    const eventsToday = log.filter((e) => e.createdAt >= today).length;
    const success = log.filter((e) => e.status === 'SUCCESS').length;
    const errors = log.length - success;
    return { eventsToday, success, errors, last: log[0]?.createdAt };
  }, [log]);

  if (!activeProject) {
    return (
      <EmptyState
        icon={Phone}
        title="No project selected"
        description="Pick a project from the home screen to configure WhatsApp calling settings."
      />
    );
  }

  const phoneNumbers = activeProject.phoneNumbers ?? [];
  const enabledCount = phoneNumbers.filter((p) => p.callingSettings?.status === 'ENABLED').length;

  return (
    <div className="flex flex-col gap-4">
      {/* API KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Numbers" value={phoneNumbers.length.toLocaleString('en-IN')} icon={Phone} delay={0.02} />
        <MetricTile label="Calling enabled" value={enabledCount.toLocaleString('en-IN')} icon={CheckCircle2} delay={0.04} />
        <MetricTile label="API events today" value={apiKpi.eventsToday.toLocaleString('en-IN')} icon={Activity} delay={0.06} />
        <MetricTile
          label="Last API call"
          value={apiKpi.last ? formatDistanceToNow(apiKpi.last, { addSuffix: false }) : '-'}
          icon={Clock}
          delay={0.08}
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {phoneNumbers.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No phone numbers linked"
              description="Add a WhatsApp Business phone number to the project first, then come back to configure calling."
              action={
                <WaButton onClick={() => (window.location.href = '/wachat/numbers')}>
                  Manage numbers
                </WaButton>
              }
            />
          ) : (
            <>
              {/* Picker */}
              <Section
                title="Configure number"
                description="Select a phone number to view and modify its calling configuration."
                action={
                  <WaButton variant="ghost" size="sm" onClick={refreshProject} disabled={isLoading} leftIcon={isLoading ? Loader2 : RefreshCw}>
                    Reload
                  </WaButton>
                }
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {phoneNumbers.map((phone, i) => {
                    const active = phone.id === selectedPhone?.id;
                    const callingEnabled = phone.callingSettings?.status === 'ENABLED';
                    return (
                      <m.button
                        key={phone.id}
                        type="button"
                        onClick={() => setSelectedPhoneId(phone.id)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors active:scale-[0.99] ${
                          active ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-semibold text-zinc-900">{phone.display_phone_number}</div>
                          <div className="truncate text-[11px] text-zinc-500">{phone.verified_name || 'Unverified'}</div>
                        </div>
                        <StatusPill tone={callingEnabled ? 'live' : 'paused'}>{callingEnabled ? 'On' : 'Off'}</StatusPill>
                      </m.button>
                    );
                  })}
                </div>
              </Section>

              {selectedPhone && <StatusBanner phone={selectedPhone} />}

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
                <Section>
                  <div className="py-6 text-center text-[12.5px] text-zinc-500">
                    Select a phone number above to manage its settings.
                  </div>
                </Section>
              )}
            </>
          )}
        </div>

        {/* API log column */}
        <div>
          <Section
            title={
              <span className="inline-flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2.25} aria-hidden />
                API call log
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-700">{log.length}</span>
              </span>
            }
            description={`${apiKpi.success} ok · ${apiKpi.errors} errors`}
            action={
              <button
                type="button"
                onClick={clearApiLog}
                disabled={log.length === 0}
                aria-label="Clear log"
                className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            }
          >
            <div className="max-h-[420px] overflow-y-auto">
              {log.length === 0 ? (
                <div className="py-6 text-center">
                  <SettingsIcon className="mx-auto h-7 w-7 text-zinc-300" strokeWidth={1.5} />
                  <p className="mt-2 text-[11.5px] text-zinc-500">
                    Nothing logged yet. Fetches and saves will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {log.map((entry) => (
                    <li key={entry.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-zinc-500">{entry.method}</span>
                        <StatusPill tone={entry.status === 'SUCCESS' ? 'live' : 'failed'}>
                          {entry.status === 'SUCCESS' ? <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} /> : <AlertCircle className="h-2.5 w-2.5" strokeWidth={3} />}
                          {entry.status}
                        </StatusPill>
                        <span className="ml-auto text-[10px] text-zinc-500">{formatDistanceToNow(entry.createdAt, { addSuffix: true })}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-zinc-900">{entry.summary}</div>
                      {entry.status === 'ERROR' && entry.errorMessage && (
                        <div className="mt-1 truncate text-[10.5px] text-rose-600">{entry.errorMessage}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ phone }: { phone: PhoneNumber }) {
  const s = phone.callingSettings;
  const enabled = s?.status === 'ENABLED';
  const callbackOn = s?.callback_permission_status === 'ENABLED';
  const sipOn = s?.sip?.status === 'ENABLED';
  const hoursOn = s?.call_hours?.status === 'ENABLED';

  const checklist = [
    { label: 'Calling enabled', ok: enabled },
    { label: 'Callback prompt', ok: callbackOn },
    { label: 'Business hours', ok: hoursOn },
    { label: 'SIP routing', ok: sipOn },
  ];

  return (
    <Section
      title="Current status"
      description={`Live configuration for ${phone.display_phone_number}.`}
      action={<StatusPill tone={enabled ? 'live' : 'paused'}>{enabled ? 'Enabled' : 'Disabled'}</StatusPill>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <span
              className="grid h-5 w-5 place-items-center rounded-full"
              style={item.ok ? { background: 'var(--mt-accent-soft)' } : { background: '#f4f4f5' }}
            >
              {item.ok
                ? <CheckCircle2 className="h-3 w-3" strokeWidth={3} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                : <AlertCircle className="h-3 w-3 text-zinc-400" strokeWidth={2.5} aria-hidden />}
            </span>
            <span className="truncate text-[11.5px] text-zinc-800">{item.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
