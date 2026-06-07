'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Mail,
  Webhook,
  CalendarClock,
  Plus,
  Check,
  Send,
  Save,
  X,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  IconButton,
  Field,
  Input,
  Switch,
  Alert,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import type { FlowNotificationSettings } from '@/lib/sabflow/types';

/* Props */

interface NotificationsPanelProps {
  flowId: string;
}

/* Email regex */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/* Toggle row */

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
        <span className="text-[13px] font-medium text-[var(--st-text)]">{label}</span>
        {description && (
          <span className="text-[11.5px] leading-snug text-[var(--st-text-secondary)]">
            {description}
          </span>
        )}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

/* Section wrapper */

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, children }: SectionProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="flex items-center gap-2.5 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
        <Icon className="h-4 w-4 text-[var(--st-text)]" strokeWidth={1.75} aria-hidden="true" />
        <CardTitle className="text-[13px] font-semibold text-[var(--st-text)]">{title}</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-3 px-4 py-3">{children}</div>
    </Card>
  );
}

/* Main component */

export function NotificationsPanel({ flowId }: NotificationsPanelProps) {
  const { toast } = useToast();

  /* State */
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

  /* Load settings */
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
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  /* Add email */
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

  /* Test webhook */
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
      if (res.ok) {
        toast.success('Webhook responded successfully.');
      } else {
        setTestError(`HTTP ${res.status}`);
        toast.error(`Webhook returned HTTP ${res.status}.`);
      }
    } catch (err) {
      setTestStatus('error');
      const message = err instanceof Error ? err.message : 'Request failed';
      setTestError(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  }, [webhookUrl, flowId, toast]);

  /* Save */
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
      if (res.ok) {
        toast.success('Notification settings saved.');
      } else {
        toast.error('Could not save notification settings.');
      }
    } catch {
      setSaveStatus('error');
      toast.error('Could not save notification settings.');
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
    toast,
  ]);

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={112} radius={12} width="100%" />
        ))}
      </div>
    );
  }

  /* Render */
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <Bell className="h-4 w-4 text-[var(--st-text)]" strokeWidth={1.75} aria-hidden="true" />
        <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Notifications</h2>
      </div>

      {/* Email section */}
      <Section icon={Mail} title="Email notifications">
        <ToggleRow
          id="emailOnSubmission"
          label="Send email on each submission"
          description="An email is sent every time someone completes this flow."
          checked={emailOnSubmission}
          onChange={setEmailOnSubmission}
        />

        {emailOnSubmission && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              Recipients
            </span>

            {/* Existing addresses */}
            {emailAddresses.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {emailAddresses.map((addr) => (
                  <li
                    key={addr}
                    className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5"
                  >
                    <span className="truncate text-[12.5px] text-[var(--st-text)]">{addr}</span>
                    <IconButton
                      icon={X}
                      label={`Remove ${addr}`}
                      size="sm"
                      onClick={() => removeEmail(addr)}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}

            {/* Add new email */}
            <div className="flex items-start gap-2">
              <Field className="flex-1" error={emailError || undefined}>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                  placeholder="name@example.com"
                  inputSize="sm"
                />
              </Field>
              <IconButton
                icon={Plus}
                label="Add email"
                variant="outline"
                onClick={addEmail}
                className="shrink-0"
              />
            </div>
          </div>
        )}
      </Section>

      {/* Webhook section */}
      <Section icon={Webhook} title="Webhook">
        <ToggleRow
          id="webhookOnSubmission"
          label="Send webhook on each submission"
          description="Posts submission data as JSON to your endpoint."
          checked={webhookOnSubmission}
          onChange={setWebhookOnSubmission}
        />

        {webhookOnSubmission && (
          <div className="flex flex-col gap-2 pt-1">
            <Field label="Webhook URL">
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value);
                    setTestStatus('idle');
                  }}
                  placeholder="https://example.com/webhook"
                  inputSize="sm"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={Send}
                  loading={testing}
                  disabled={!webhookUrl.trim()}
                  onClick={handleTestWebhook}
                  className="shrink-0"
                >
                  Test
                </Button>
              </div>
            </Field>

            {/* Test result */}
            {testStatus !== 'idle' && (
              <Alert tone={testStatus === 'ok' ? 'success' : 'danger'}>
                {testStatus === 'ok'
                  ? 'Webhook responded successfully.'
                  : testError || 'Webhook request failed.'}
              </Alert>
            )}
          </div>
        )}
      </Section>

      {/* Digest section */}
      <Section icon={CalendarClock} title="Digest email">
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
            <Field label="Frequency" className="flex-1">
              <Select
                value={digestFrequency}
                onValueChange={(v) => setDigestFrequency(v as 'daily' | 'weekly')}
              >
                <SelectTrigger aria-label="Digest frequency">
                  <SelectValue placeholder="Pick a frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {/* Time input */}
            <Field label="At time" className="w-28">
              <Input
                type="time"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
                inputSize="sm"
              />
            </Field>
          </div>
        )}
      </Section>

      {/* Save button */}
      <Button
        variant="primary"
        block
        loading={saving}
        iconLeft={saveStatus === 'saved' ? Check : Save}
        onClick={handleSave}
      >
        {saveStatus === 'saved'
          ? 'Saved'
          : saveStatus === 'error'
            ? 'Save failed'
            : 'Save settings'}
      </Button>
    </div>
  );
}
