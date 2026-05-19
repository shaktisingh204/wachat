'use client';

import { useState, useEffect } from 'react';
import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import { Plus, Trash2, Webhook } from 'lucide-react';

const STORAGE_KEY = 'url-shortener-webhooks';

const ALL_EVENTS = ['Click', 'First Click', 'Link Expired', 'Link Dead'] as const;
type WebhookEvent = (typeof ALL_EVENTS)[number];

type WebhookRow = {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
};

export default function UrlShortenerWebhooksPage() {
  const { toast } = useZoruToast();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<Set<WebhookEvent>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setWebhooks(raw ? JSON.parse(raw) : []);
    } catch { /* ignore */ }
  }, []);

  const persist = (next: WebhookRow[]) => {
    setWebhooks(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    if (!/^https:\/\//.test(formUrl)) {
      toast({ title: 'Invalid URL', description: 'Endpoint must start with https://', variant: 'destructive' });
      return;
    }
    if (formEvents.size === 0) {
      toast({ title: 'No events selected', description: 'Select at least one event.', variant: 'destructive' });
      return;
    }
    const next: WebhookRow = {
      id: crypto.randomUUID(),
      url: formUrl,
      events: Array.from(formEvents),
      secret: formSecret,
      active: true,
    };
    persist([next, ...webhooks]);
    setFormUrl('');
    setFormSecret('');
    setFormEvents(new Set());
    setShowForm(false);
    toast({ title: 'Webhook added' });
  };

  const toggleEvent = (ev: WebhookEvent) => {
    const next = new Set(formEvents);
    if (next.has(ev)) next.delete(ev);
    else next.add(ev);
    setFormEvents(next);
  };

  const toggleActive = (id: string) => {
    persist(webhooks.map((w) => (w.id === id ? { ...w, active: !w.active } : w)));
  };

  const handleDelete = (id: string) => {
    persist(webhooks.filter((w) => w.id !== id));
    toast({ title: 'Webhook removed' });
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Home</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/url-shortener">URL Shortener</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/url-shortener/settings">Settings</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Webhooks</ZoruPageTitle>
            <ZoruPageDescription>
              Receive HTTP callbacks when link events occur.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
        <ZoruButton size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          Add Webhook
        </ZoruButton>
      </div>

      {showForm ? (
        <ZoruCard className="p-5 space-y-4">
          <h3 className="text-[14px] text-zoru-ink">New Webhook</h3>
          <div className="space-y-1.5">
            <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Endpoint URL</ZoruLabel>
            <ZoruInput
              placeholder="https://yourserver.com/webhook"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Secret (Optional)</ZoruLabel>
            <ZoruInput
              placeholder="Signing secret"
              value={formSecret}
              onChange={(e) => setFormSecret(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">Events</ZoruLabel>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => {
                const on = formEvents.has(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEvent(ev)}
                    className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                      on
                        ? 'border-zoru-ink bg-zoru-ink text-zoru-bg'
                        : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink'
                    }`}
                  >
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <ZoruButton size="sm" onClick={handleAdd}>Save</ZoruButton>
            <ZoruButton size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</ZoruButton>
          </div>
        </ZoruCard>
      ) : null}

      {webhooks.length === 0 && !showForm ? (
        <ZoruCard className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
            <Webhook className="h-5 w-5" />
          </div>
          <p className="text-sm text-zoru-ink">No webhooks configured</p>
          <p className="mt-1 text-xs text-zoru-ink-muted">
            Add a webhook to receive real-time notifications when link events occur.
          </p>
        </ZoruCard>
      ) : webhooks.length > 0 ? (
        <ZoruCard className="p-0">
          <ul className="divide-y divide-zoru-line">
            {webhooks.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] text-zoru-ink">{w.url}</span>
                    {w.active ? (
                      <ZoruBadge variant="success">Active</ZoruBadge>
                    ) : (
                      <ZoruBadge variant="ghost">Paused</ZoruBadge>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.events.map((ev) => (
                      <ZoruBadge key={ev} variant="outline" className="text-[10.5px]">{ev}</ZoruBadge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ZoruSwitch
                    checked={w.active}
                    onCheckedChange={() => toggleActive(w.id)}
                    aria-label="Toggle webhook active"
                  />
                  <button
                    type="button"
                    onClick={() => handleDelete(w.id)}
                    className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-danger/10 hover:text-zoru-danger-ink"
                    aria-label="Delete webhook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ZoruCard>
      ) : null}
    </div>
  );
}
