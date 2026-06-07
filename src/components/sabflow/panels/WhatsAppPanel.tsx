'use client';

/**
 * SabFlow - WhatsApp channel settings panel
 *
 * Renders a form for connecting a flow to a WhatsApp Business Cloud channel
 * (phone number ID, access token, verify token, business account ID) and
 * surfaces the webhook URL that must be pasted into the Meta App dashboard.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Info,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Badge,
  Dot,
  Callout,
  Skeleton,
} from '@/components/sabcrm/20ui';
import type { WhatsAppConfig } from '@/lib/sabflow/whatsapp/types';

/* -- Props ------------------------------------------------- */

interface WhatsAppPanelProps {
  flowId: string;
}

/* -- Helpers ----------------------------------------------- */

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

/* -- Section wrapper (Card-based) -------------------------- */

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}

function Section({ icon: Icon, title, children, rightSlot }: SectionProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} aria-hidden="true" />
          <CardTitle className="text-[13px]">{title}</CardTitle>
        </div>
        {rightSlot}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">{children}</CardBody>
    </Card>
  );
}

/* -- Copyable read-only row -------------------------------- */

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
      /* noop - browsers without clipboard permission */
    }
  }, [value]);

  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className={monospace ? 'flex-1 font-mono' : 'flex-1'}
          onFocus={(e) => e.currentTarget.select()}
        />
        <IconButton
          label={copied ? `${label} copied` : `Copy ${label}`}
          icon={copied ? Check : Copy}
          variant={copied ? 'outline' : 'secondary'}
          onClick={handleCopy}
          className="shrink-0"
        />
      </div>
    </Field>
  );
}

/* -- Main component ---------------------------------------- */

export function WhatsAppPanel({ flowId }: WhatsAppPanelProps) {
  /* -- State ----------------------------------------------- */
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
  // indicates a token is already stored. We render the masked placeholder
  // in that case and only send a new token when the user actually types one.
  const [hasStoredToken, setHasStoredToken] = useState(false);

  /* -- Derived --------------------------------------------- */
  const webhookUrl = useMemo(() => buildWebhookUrl(flowId), [flowId]);

  const isConfigured = Boolean(
    phoneNumberId && businessAccountId && verifyToken && (hasStoredToken || accessToken),
  );

  /* -- Load existing config -------------------------------- */
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
              // Fresh - pre-generate a verify token so the user can copy it
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

  /* -- Regenerate verify token ----------------------------- */
  const handleRegenerateVerifyToken = useCallback(() => {
    setVerifyToken(generateVerifyToken());
  }, []);

  /* -- Save ------------------------------------------------ */
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

  /* -- Loading skeleton ------------------------------------ */
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={128} radius={12} />
        ))}
      </div>
    );
  }

  /* -- Render ---------------------------------------------- */
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-[var(--st-text)]">WhatsApp Business</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Dot tone={isConfigured ? 'success' : 'neutral'} pulse={isConfigured} aria-hidden="true" />
          <span className="text-[11.5px] font-medium text-[var(--st-text-secondary)]">
            {isConfigured ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Connect section */}
      <Section icon={MessageCircle} title="Connect WhatsApp Business API">
        <Field label="Phone Number ID">
          <Input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="e.g. 105954345705861"
          />
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2">
              Access Token
              {hasStoredToken ? (
                <Badge tone="success" kind="soft">
                  Saved
                </Badge>
              ) : null}
            </span>
          }
        >
          <div className="flex gap-2">
            <Input
              type={showToken ? 'text' : 'password'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={hasStoredToken ? 'Leave blank to keep existing token' : 'EAAG...'}
              autoComplete="off"
              className="flex-1 font-mono"
            />
            <IconButton
              label={showToken ? 'Hide token' : 'Show token'}
              icon={showToken ? EyeOff : Eye}
              variant="secondary"
              onClick={() => setShowToken((s) => !s)}
              className="shrink-0"
            />
          </div>
        </Field>

        <Field label="Verify Token">
          <div className="flex gap-2">
            <Input
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Auto-generated on load"
              className="flex-1 font-mono"
            />
            <IconButton
              label="Regenerate verify token"
              icon={RefreshCw}
              variant="secondary"
              onClick={handleRegenerateVerifyToken}
              className="shrink-0"
            />
          </div>
        </Field>

        <Field label="Business Account ID (WABA)">
          <Input
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="e.g. 104254435827164"
          />
        </Field>
      </Section>

      {/* Webhook section */}
      <Section icon={Copy} title="Webhook URL">
        <CopyRow label="Callback URL" value={webhookUrl} monospace />
        <CopyRow label="Verify Token" value={verifyToken} monospace />
        <p className="text-[11.5px] leading-relaxed text-[var(--st-text-secondary)]">
          Paste both values into the <strong>Webhook</strong> panel of your Meta app and subscribe
          to the{' '}
          <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[11px]">
            messages
          </code>{' '}
          field on the WhatsApp Business Account.
        </p>
      </Section>

      {/* Setup instructions */}
      <Section icon={Info} title="Setup instructions">
        <ol className="flex flex-col gap-2 pl-4 list-decimal text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
          <li>
            Create a Meta Developer app at{' '}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--st-accent)] hover:underline"
            >
              developers.facebook.com/apps
            </a>{' '}
            and add the <strong>WhatsApp</strong> product.
          </li>
          <li>
            In <strong>WhatsApp, API Setup</strong>, copy the <strong>Phone number ID</strong> and
            the <strong>WhatsApp Business Account ID</strong>, then paste them above.
          </li>
          <li>
            Generate a permanent access token for a System User that has
            <em> whatsapp_business_messaging </em> and
            <em> whatsapp_business_management </em> permissions, and paste it into{' '}
            <strong>Access Token</strong>.
          </li>
          <li>
            In <strong>WhatsApp, Configuration</strong>, click <strong>Edit</strong> on the webhook,
            paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> from the
            section above, then <strong>Verify and save</strong>.
          </li>
          <li>
            Subscribe the webhook to the{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[11px]">
              messages
            </code>{' '}
            field so incoming chats are delivered to SabFlow.
          </li>
          <li>
            Send a test message to your WhatsApp business number. The flow will start automatically
            on the first inbound message.
          </li>
        </ol>
      </Section>

      {/* Save error notice */}
      {saveStatus === 'error' ? (
        <Callout tone="danger">{saveError || 'Save failed'}</Callout>
      ) : null}

      {/* Save */}
      <Button
        variant={saveStatus === 'saved' ? 'outline' : 'primary'}
        size="lg"
        block
        loading={saving}
        iconLeft={saveStatus === 'saved' ? Check : Save}
        onClick={handleSave}
      >
        {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save configuration'}
      </Button>
    </div>
  );
}
