'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  LuBell,
  LuMail,
  LuWebhook,
  LuCalendarClock,
  LuPlus,
  LuX,
  LuCheck,
  LuLoader,
  LuSend,
  LuSave,
  LuAlertCircle,
  LuChevronDown,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { FlowNotificationSettings } from '@/lib/sabflow/types';

/* ── Props ───────────────────────────────────────────────── */

interface NotificationsPanelProps {
  flowId: string;
}

/* ── Email regex ─────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/* ── Toggle row ──────────────────────────────────────────── */

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 py-2"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        {description && (
          <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-snug">
            {description}
          </span>
        )}
      </div>
      {/* Toggle pill */}
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
          checked
            ? 'bg-amber-500'
            : 'bg-zinc-200 dark:bg-zinc-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

/* ── Section wrapper ─────────────────────────────────────── */

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <Icon className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
        <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
          {title}
        </span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">{children}</div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */

export function NotificationsPanel({ flowId }: NotificationsPanelProps) {
  /* ── State ─────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // Email section
  const [emailOnSubmission, setEmailOnSubmission] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Webhook section
  const [webhookOnSubmission, setWebhookOnSubmission] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Digest section
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestFrequency, setDigestFrequency] = useState<'daily' | 'weekly'>('daily');
  const [digestTime, setDigestTime] = useState('09:00');

  /* ── Load settings ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sabflow/${flowId}/notifications`);
        if (res.ok) {
          const data: FlowNotificationSettings = await res.json();
          if (!cancelled) {
            setEmailOnSubmission(data.emailOnSubmission);
            setEmailAddresses(data.emailAddresses);
            setWebhookOnSubmission(data.webhookOnSubmission);
            setWebhookUrl(data.webhookUrl ?? '');
            setDigestEnabled(data.digestEnabled);
            setDigestFrequency(data.digestFrequency);
            setDigestTime(data.digestTime ?? '09:00');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [flowId]);

  /* ── Add email ─────────────────────────────────────────── */
  const addEmail = useCallback(() => {
    const val = newEmail.trim();
    if (!val) return;
    if (!isValidEmail(val)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (emailAddresses.includes(val)) {
      setEmailError('This address is already in the list.');
      return;
    }
    setEmailAddresses((prev) => [...prev, val]);
    setNewEmail('');
    setEmailError('');
  }, [newEmail, emailAddresses]);

  const removeEmail = useCallback((addr: string) => {
    setEmailAddresses((prev) => prev.filter((e) => e !== addr));
  }, []);

  /* ── Test webhook ──────────────────────────────────────── */
  const handleTestWebhook = useCallback(async () => {
    if (!webhookUrl.trim()) return;
    setTesting(true);
    setTestStatus('idle');
    setTestError('');
    try {
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test',
          flowId,
          timestamp: new Date().toISOString(),
          message: 'SabFlow webhook test',
        }),
      });
      setTestStatus(res.ok ? 'ok' : 'error');
      if (!res.ok) setTestError(`HTTP ${res.status}`);
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setTesting(false);
    }
  }, [webhookUrl, flowId]);

  /* ── Save ──────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const payload: FlowNotificationSettings = {
        flowId,
        emailOnSubmission,
        emailAddresses,
        webhookUrl: webhookUrl.trim() || undefined,
        webhookOnSubmission,
        digestEnabled,
        digestFrequency,
        digestTime: digestTime || undefined,
      };
      const res = await fetch(`/api/sabflow/${flowId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      // Reset saved status after 3 s
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [
    flowId,
    emailOnSubmission,
    emailAddresses,
    webhookUrl,
    webhookOnSubmission,
    digestEnabled,
    digestFrequency,
    digestTime,
  ]);

  /* ── Loading skeleton ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-4 p-4">

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <LuBell className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
        <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
          Notifications
        </h2>
      </div>

      {/* ── Email section ─────────────────────────────── */}
      <Section icon={LuMail} title="Email notifications">
        <ToggleRow
          id="emailOnSubmission"
          label="Send email on each submission"
          description="An email is sent every time someone completes this flow."
          checked={emailOnSubmission}
          onChange={setEmailOnSubmission}
        />

        {emailOnSubmission && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400">
              Recipients
            </span>

            {/* Existing addresses */}
            {emailAddresses.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {emailAddresses.map((addr) => (
                  <li
                    key={addr}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5"
                  >
                    <span className="text-[12.5px] text-zinc-700 dark:text-zinc-300 truncate">
                      {addr}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEmail(addr)}
                      className="shrink-0 text-zinc-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${addr}`}
                    >
                      <LuX className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new email */}
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                  placeholder="name@example.com"
                  className={cn(
                    'w-full rounded-lg border px-3 py-1.5 text-[12.5px] bg-white dark:bg-zinc-800 outline-none transition-colors',
                    'focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500',
                    emailError
                      ? 'border-red-400 dark:border-red-600'
                      : 'border-zinc-200 dark:border-zinc-700',
                  )}
                />
                {emailError && (
                  <span className="text-[11px] text-red-500 flex items-center gap-1">
                    <LuAlertCircle className="h-3 w-3" />
                    {emailError}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={addEmail}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-400 transition-colors"
                aria-label="Add email"
              >
                <LuPlus className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* ── Webhook section ───────────────────────────── */}
      <Section icon={LuWebhook} title="Webhook">
        <ToggleRow
          id="webhookOnSubmission"
          label="Send webhook on each submission"
          description="Posts submission data as JSON to your endpoint."
          checked={webhookOnSubmission}
          onChange={setWebhookOnSubmission}
        />

        {webhookOnSubmission && (
          <div className="flex flex-col gap-2 pt-1">
            <label className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setTestStatus('idle'); }}
                placeholder="https://example.com/webhook"
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testing || !webhookUrl.trim()}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                  'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800',
                  'hover:border-amber-400 hover:text-amber-600 disabled:opacity-40 disabled:pointer-events-none',
                )}
              >
                {testing ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuSend className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                Test
              </button>
            </div>

            {/* Test result */}
            {testStatus !== 'idle' && (
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px]',
                  testStatus === 'ok'
                    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
                )}
              >
                {testStatus === 'ok' ? (
                  <>
                    <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Webhook responded successfully.
                  </>
                ) : (
                  <>
                    <LuAlertCircle className="h-3.5 w-3.5" />
                    {testError || 'Webhook request failed.'}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Digest section ────────────────────────────── */}
      <Section icon={LuCalendarClock} title="Digest email">
        <ToggleRow
          id="digestEnabled"
          label="Send periodic digest"
          description="Receive a summary of recent submissions on a schedule."
          checked={digestEnabled}
          onChange={setDigestEnabled}
        />

        {digestEnabled && (
          <div className="flex gap-3 pt-1">
            {/* Frequency select */}
            <div className="flex flex-col gap-1 flex-1">
              <label
                htmlFor="digestFrequency"
                className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400"
              >
                Frequency
              </label>
              <div className="relative">
                <select
                  id="digestFrequency"
                  value={digestFrequency}
                  onChange={(e) =>
                    setDigestFrequency(e.target.value as 'daily' | 'weekly')
                  }
                  className="w-full appearance-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 pr-8 text-[12.5px] text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <LuChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>

            {/* Time input */}
            <div className="flex flex-col gap-1 w-28">
              <label
                htmlFor="digestTime"
                className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400"
              >
                At time
              </label>
              <input
                id="digestTime"
                type="time"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        )}
      </Section>

      {/* ── Save button ───────────────────────────────── */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors',
          'bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:pointer-events-none',
          saveStatus === 'error' && 'bg-red-500 hover:bg-red-600',
        )}
      >
        {saving ? (
          <>
            <LuLoader className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : saveStatus === 'saved' ? (
          <>
            <LuCheck className="h-4 w-4" strokeWidth={2.5} />
            Saved
          </>
        ) : saveStatus === 'error' ? (
          <>
            <LuAlertCircle className="h-4 w-4" />
            Save failed
          </>
        ) : (
          <>
            <LuSave className="h-4 w-4" strokeWidth={1.75} />
            Save settings
          </>
        )}
      </button>
    </div>
  );
}
