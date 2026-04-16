'use client';

/**
 * SabFlow — WhatsApp channel settings panel
 *
 * Renders a form for connecting a flow to a WhatsApp Business Cloud channel
 * (phone number ID, access token, verify token, business account ID) and
 * surfaces the webhook URL that must be pasted into the Meta App dashboard.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LuMessageCircle,
  LuCopy,
  LuCheck,
  LuInfo,
  LuLoader,
  LuCircleAlert,
  LuSave,
  LuEye,
  LuEyeOff,
  LuRefreshCw,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { WhatsAppConfig } from '@/lib/sabflow/whatsapp/types';

/* ── Props ───────────────────────────────────────────────── */

interface WhatsAppPanelProps {
  flowId: string;
}

/* ── Helpers ─────────────────────────────────────────────── */

const TOKEN_MASK = '********';

function generateVerifyToken(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (should not hit in the browser, but keeps TS + SSR happy).
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function buildWebhookUrl(flowId: string): string {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/api/sabflow/whatsapp/webhook/${flowId}`;
  }
  return `https://yourapp.com/api/sabflow/whatsapp/webhook/${flowId}`;
}

/* ── Section wrapper (matches NotificationsPanel styling) ─ */

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}

function Section({ icon: Icon, title, children, rightSlot }: SectionProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
          <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
            {title}
          </span>
        </div>
        {rightSlot}
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">{children}</div>
    </div>
  );
}

/* ── Copyable read-only row ──────────────────────────────── */

interface CopyRowProps {
  label: string;
  value: string;
  monospace?: boolean;
}

function CopyRow({ label, value, monospace }: CopyRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop — browsers without clipboard permission */
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className={cn(
            'flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] text-zinc-700 dark:text-zinc-300 outline-none',
            monospace && 'font-mono',
          )}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
            copied
              ? 'border-green-400 text-green-600 bg-green-50 dark:bg-green-950/30'
              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-400',
          )}
        >
          {copied ? (
            <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : (
            <LuCopy className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */

export function WhatsAppPanel({ flowId }: WhatsAppPanelProps) {
  /* ── State ───────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string>('');

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [showToken, setShowToken] = useState(false);

  // "hasStoredToken" becomes true after a successful load when the server
  // indicates a token is already stored.  We render the masked placeholder
  // in that case and only send a new token when the user actually types one.
  const [hasStoredToken, setHasStoredToken] = useState(false);

  /* ── Derived ─────────────────────────────────────────── */
  const webhookUrl = useMemo(() => buildWebhookUrl(flowId), [flowId]);

  const isConfigured = Boolean(
    phoneNumberId && businessAccountId && verifyToken && (hasStoredToken || accessToken),
  );

  /* ── Load existing config ────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sabflow/whatsapp/${flowId}/config`);
        if (res.ok) {
          const data: { config: WhatsAppConfig | null } = await res.json();
          if (!cancelled) {
            if (data.config) {
              setPhoneNumberId(data.config.phoneNumberId);
              setBusinessAccountId(data.config.businessAccountId);
              setVerifyToken(data.config.verifyToken);
              setHasStoredToken(data.config.accessToken === TOKEN_MASK);
              setAccessToken(''); // Never populate the token field
            } else {
              // Fresh — pre-generate a verify token so the user can copy it
              // into Meta immediately.
              setVerifyToken(generateVerifyToken());
            }
          }
        } else if (!cancelled) {
          setVerifyToken(generateVerifyToken());
        }
      } catch {
        if (!cancelled) setVerifyToken(generateVerifyToken());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  /* ── Regenerate verify token ─────────────────────────── */
  const handleRegenerateVerifyToken = useCallback(() => {
    setVerifyToken(generateVerifyToken());
  }, []);

  /* ── Save ────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    if (!phoneNumberId.trim() || !businessAccountId.trim() || !verifyToken.trim()) {
      setSaveStatus('error');
      setSaveError('Phone Number ID, Business Account ID, and Verify Token are required.');
      return;
    }
    if (!hasStoredToken && !accessToken.trim()) {
      setSaveStatus('error');
      setSaveError('Access Token is required on first save.');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      const res = await fetch(`/api/sabflow/whatsapp/${flowId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: phoneNumberId.trim(),
          // Leave blank/mask to mean "don't change".
          accessToken: accessToken.trim() || (hasStoredToken ? TOKEN_MASK : ''),
          verifyToken: verifyToken.trim(),
          businessAccountId: businessAccountId.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveStatus('error');
        setSaveError(typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`);
        return;
      }

      setSaveStatus('saved');
      setHasStoredToken(true);
      setAccessToken('');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
    }
  }, [flowId, phoneNumberId, accessToken, verifyToken, businessAccountId, hasStoredToken]);

  /* ── Loading skeleton ────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <LuMessageCircle className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
          <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">
            WhatsApp Business
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConfigured ? 'bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.18)]' : 'bg-zinc-300 dark:bg-zinc-600',
            )}
            aria-hidden
          />
          <span className="text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
            {isConfigured ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Connect section */}
      <Section icon={LuMessageCircle} title="Connect WhatsApp Business API">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="wa-phone-number-id"
            className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400"
          >
            Phone Number ID
          </label>
          <input
            id="wa-phone-number-id"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="e.g. 105954345705861"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="wa-access-token"
            className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400"
          >
            Access Token
            {hasStoredToken && (
              <span className="ml-2 rounded bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400 normal-case tracking-normal">
                Saved
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              id="wa-access-token"
              type={showToken ? 'text' : 'password'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={hasStoredToken ? 'Leave blank to keep existing token' : 'EAAG…'}
              autoComplete="off"
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken((s) => !s)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-400 transition-colors"
            >
              {showToken ? (
                <LuEyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <LuEye className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="wa-verify-token"
            className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400"
          >
            Verify Token
          </label>
          <div className="flex gap-2">
            <input
              id="wa-verify-token"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Auto-generated on load"
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors font-mono"
            />
            <button
              type="button"
              onClick={handleRegenerateVerifyToken}
              aria-label="Regenerate verify token"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-400 transition-colors"
            >
              <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="wa-business-account-id"
            className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-400"
          >
            Business Account ID (WABA)
          </label>
          <input
            id="wa-business-account-id"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="e.g. 104254435827164"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
          />
        </div>
      </Section>

      {/* Webhook section */}
      <Section icon={LuCopy} title="Webhook URL">
        <CopyRow label="Callback URL" value={webhookUrl} monospace />
        <CopyRow label="Verify Token" value={verifyToken} monospace />
        <p className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Paste both values into the <strong>Webhook</strong> panel of your
          Meta app and subscribe to the <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 font-mono text-[11px]">messages</code> field on the WhatsApp
          Business Account.
        </p>
      </Section>

      {/* Setup instructions */}
      <Section icon={LuInfo} title="Setup instructions">
        <ol className="flex flex-col gap-2 pl-4 list-decimal text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          <li>
            Create a Meta Developer app at{' '}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline"
            >
              developers.facebook.com/apps
            </a>{' '}
            and add the <strong>WhatsApp</strong> product.
          </li>
          <li>
            In <strong>WhatsApp → API Setup</strong>, copy the{' '}
            <strong>Phone number ID</strong> and the{' '}
            <strong>WhatsApp Business Account ID</strong>, then paste them
            above.
          </li>
          <li>
            Generate a permanent access token for a System User that has
            <em> whatsapp_business_messaging </em> and
            <em> whatsapp_business_management </em> permissions, and paste it
            into <strong>Access Token</strong>.
          </li>
          <li>
            In <strong>WhatsApp → Configuration</strong>, click{' '}
            <strong>Edit</strong> on the webhook, paste the{' '}
            <strong>Callback URL</strong> and <strong>Verify Token</strong>{' '}
            from the section above, then <strong>Verify and save</strong>.
          </li>
          <li>
            Subscribe the webhook to the{' '}
            <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 font-mono text-[11px]">
              messages
            </code>{' '}
            field so incoming chats are delivered to SabFlow.
          </li>
          <li>
            Send a test message to your WhatsApp business number — the flow
            will start automatically on the first inbound message.
          </li>
        </ol>
      </Section>

      {/* Save */}
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
            <LuCircleAlert className="h-4 w-4" />
            {saveError || 'Save failed'}
          </>
        ) : (
          <>
            <LuSave className="h-4 w-4" strokeWidth={1.75} />
            Save configuration
          </>
        )}
      </button>
    </div>
  );
}
