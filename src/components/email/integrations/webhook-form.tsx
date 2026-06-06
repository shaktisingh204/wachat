'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Switch, toast } from '@/components/sabcrm/20ui/compat';
import {
  actionCreateEmailWebhook,
  actionUpdateEmailWebhook,
  type EmailWebhookDoc,
  type EmailWebhookEvent,
} from '@/app/actions/email/integrations.actions';

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode if provided. */
  webhook?: EmailWebhookDoc | null;
  onSaved: () => void;
}

const AVAILABLE_EVENTS: { value: EmailWebhookEvent; label: string }[] = [
  { value: 'message.sent', label: 'message.sent' },
  { value: 'message.delivered', label: 'message.delivered' },
  { value: 'message.opened', label: 'message.opened' },
  { value: 'message.clicked', label: 'message.clicked' },
  { value: 'message.bounced', label: 'message.bounced' },
  { value: 'message.complained', label: 'message.complained' },
  { value: 'message.unsubscribed', label: 'message.unsubscribed' },
  { value: 'campaign.completed', label: 'campaign.completed' },
  { value: 'journey.step.completed', label: 'journey.step.completed' },
];

export function WebhookForm({ open, onOpenChange, webhook, onSaved }: WebhookFormProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<EmailWebhookEvent[]>([]);
  const [active, setActive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName(webhook?.name ?? '');
    setUrl(webhook?.url ?? '');
    setEvents(webhook?.events ?? []);
    setActive(webhook?.active ?? true);
    setCopied(false);
  }, [open, webhook]);

  const toggleEvent = (ev: EmailWebhookEvent) => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const handleSave = () => {
    if (!url.trim()) {
      toast({ title: 'URL is required', variant: 'destructive' });
      return;
    }
    if (events.length === 0) {
      toast({ title: 'Pick at least one event', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = webhook
        ? await actionUpdateEmailWebhook(webhook._id, {
            name: name.trim() || undefined,
            url: url.trim(),
            events,
            active,
          })
        : await actionCreateEmailWebhook({
            name: name.trim() || undefined,
            url: url.trim(),
            events,
            active,
          });
      if (!result.ok) {
        toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: webhook ? 'Webhook updated' : 'Webhook created' });
      onSaved();
      onOpenChange(false);
    });
  };

  const handleCopySecret = useCallback(async () => {
    if (!webhook?.signingSecret) return;
    try {
      await navigator.clipboard.writeText(webhook.signingSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }, [webhook?.signingSecret]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {webhook ? 'Edit webhook' : 'New webhook'}
          </DialogTitle>
          <DialogDescription>
            SabNode will POST signed JSON payloads to this URL on each subscribed event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hook-name">Name (optional)</Label>
            <Input
              id="hook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer.io sync"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hook-url">Endpoint URL</Label>
            <Input
              id="hook-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/sabnode-email"
            />
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map((ev) => {
                const checked = events.includes(ev.value);
                const inputId = `event-${ev.value}`;
                return (
                  <label
                    key={ev.value}
                    htmlFor={inputId}
                    className="flex cursor-pointer items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5 text-xs hover:bg-[var(--st-bg-muted)]"
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={() => toggleEvent(ev.value)}
                    />
                    <span className="font-mono text-[var(--st-text)]">{ev.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
            <div>
              <Label htmlFor="hook-active">Active</Label>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Inactive webhooks receive no deliveries.
              </p>
            </div>
            <Switch
              id="hook-active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          {webhook?.signingSecret ? (
            <div className="space-y-1.5">
              <Label>Signing secret</Label>
              <div className="flex items-center gap-2 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2">
                <code className="flex-1 truncate text-xs text-[var(--st-text)]">
                  {webhook.signingSecret}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopySecret}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Use this secret to verify the <code>X-SabNode-Signature</code> header.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {webhook ? 'Save changes' : 'Create webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
