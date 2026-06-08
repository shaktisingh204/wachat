'use client';

import { useState, useEffect, useMemo } from 'react';
import { fmtDate } from "@/lib/utils";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  IconButton,
  Card,
  CardTitle,
  Field,
  Input,
  Switch,
  Skeleton,
  EmptyState,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  PageEyebrow,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, Trash2, Webhook, Search, AlertCircle, Zap, Pause, Radio } from 'lucide-react';

const STORAGE_KEY = 'url-shortener-webhooks';

const ALL_EVENTS = ['Click', 'First Click', 'Link Expired', 'Link Dead', 'UTM Triggered', 'Country Detected'] as const;
type WebhookEvent = (typeof ALL_EVENTS)[number];

type WebhookRow = {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdAt: string;
};

// --- API Typings ---
type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  success: boolean;
};

// --- Mock API Methods ---
const apiFetchWebhooks = async (): Promise<ApiResponse<WebhookRow[]>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw).map((w: any) => ({
            ...w,
            createdAt: w.createdAt || new Date().toISOString()
          }));
          resolve({ data: parsed, error: null, success: true });
        } else {
          resolve({ data: [], error: null, success: true });
        }
      } catch (err: any) {
        resolve({ data: null, error: err.message || 'Failed to fetch', success: false });
      }
    }, 600);
  });
};

const apiSaveWebhooks = async (webhooks: WebhookRow[]): Promise<ApiResponse<WebhookRow[]>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(webhooks));
        resolve({ data: webhooks, error: null, success: true });
      } catch (err: any) {
        resolve({ data: null, error: err.message || 'Failed to save', success: false });
      }
    }, 400);
  });
};

// --- Sub-Components ---

function WebhookSkeleton() {
  return (
    <Card padding="none">
      <ul className="divide-y divide-[var(--st-border)]">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton height={16} width={192} />
                <Skeleton height={20} width={48} radius={999} />
              </div>
              <div className="flex gap-1.5">
                <Skeleton height={20} width={64} radius={4} />
                <Skeleton height={20} width={80} radius={4} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton height={20} width={36} radius={999} />
              <Skeleton height={32} width={32} radius={4} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WebhookForm({
  onSave,
  onCancel,
  isSaving
}: {
  onSave: (url: string, secret: string, events: WebhookEvent[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<Set<WebhookEvent>>(new Set());

  const handleSave = () => {
    if (!/^https:\/\//.test(formUrl)) {
      toast({ title: 'Invalid URL', description: 'Endpoint must start with https://', tone: 'danger' });
      return;
    }
    if (formEvents.size === 0) {
      toast({ title: 'No events selected', description: 'Select at least one event.', tone: 'danger' });
      return;
    }
    onSave(formUrl, formSecret, Array.from(formEvents));
  };

  const toggleEvent = (ev: WebhookEvent) => {
    const next = new Set(formEvents);
    if (next.has(ev)) next.delete(ev);
    else next.add(ev);
    setFormEvents(next);
  };

  return (
    <Card padding="lg" className="space-y-4">
      <CardTitle className="flex items-center gap-2">
        <Webhook className="h-4 w-4" aria-hidden="true" /> New webhook
      </CardTitle>
      <Field label="Endpoint URL">
        <Input
          placeholder="https://yourserver.com/webhook"
          value={formUrl}
          onChange={(e) => setFormUrl(e.target.value)}
          disabled={isSaving}
        />
      </Field>
      <Field label="Secret (optional)">
        <Input
          placeholder="Signing secret for payload verification"
          value={formSecret}
          onChange={(e) => setFormSecret(e.target.value)}
          disabled={isSaving}
        />
      </Field>
      <Field label="Triggers">
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((ev) => {
            const on = formEvents.has(ev);
            return (
              <Button
                key={ev}
                size="sm"
                variant={on ? 'primary' : 'outline'}
                onClick={() => toggleEvent(ev)}
                disabled={isSaving}
                aria-pressed={on}
              >
                {ev}
              </Button>
            );
          })}
        </div>
      </Field>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={handleSave} loading={isSaving}>
          {isSaving ? 'Saving' : 'Save webhook'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
      </div>
    </Card>
  );
}

function WebhookListItem({
  webhook,
  onToggleActive,
  onDelete
}: {
  webhook: WebhookRow;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--st-bg-secondary)] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="truncate text-[14px] text-[var(--st-text)] font-medium">{webhook.url}</span>
          {webhook.active ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="neutral">Paused</Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {webhook.events.map((ev) => (
            <Badge key={ev} tone="neutral" kind="outline">{ev}</Badge>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-[var(--st-text-secondary)] flex items-center gap-1">
          <span>Created: {fmtDate(webhook.createdAt)}</span>
          {webhook.secret && (
            <>
              <span className="mx-1" aria-hidden="true">·</span>
              <span>Secured</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Switch
          checked={webhook.active}
          onCheckedChange={() => onToggleActive(webhook.id)}
          aria-label="Toggle webhook active"
        />
        <IconButton
          label="Delete webhook"
          icon={Trash2}
          variant="danger"
          size="sm"
          onClick={() => onDelete(webhook.id)}
        />
      </div>
    </li>
  );
}

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

export default function UrlShortenerWebhooksPage() {
  const { toast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');

  useEffect(() => {
    setIsMounted(true);
    loadWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWebhooks = async () => {
    setIsLoading(true);
    const res = await apiFetchWebhooks();
    if (!res.success || !res.data) {
      toast({ title: 'Could not load webhooks', description: res.error || 'Failed to load webhooks.', tone: 'danger' });
      setWebhooks([]);
    } else {
      setWebhooks(res.data);
    }
    setIsLoading(false);
  };

  const handleAdd = async (url: string, secret: string, events: WebhookEvent[]) => {
    setIsSaving(true);
    const newWebhook: WebhookRow = {
      id: crypto.randomUUID(),
      url,
      events,
      secret,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const next = [newWebhook, ...webhooks];
    const res = await apiSaveWebhooks(next);

    setIsSaving(false);
    if (!res.success) {
      toast({ title: 'Could not save webhook', description: res.error || 'Failed to save.', tone: 'danger' });
    } else {
      setWebhooks(res.data || []);
      setShowForm(false);
      toast({ title: 'Webhook added', tone: 'success' });
    }
  };

  const toggleActive = async (id: string) => {
    const next = webhooks.map((w) => (w.id === id ? { ...w, active: !w.active } : w));
    // Optimistic update
    setWebhooks(next);

    const res = await apiSaveWebhooks(next);
    if (!res.success) {
      toast({ title: 'Could not update webhook', description: 'Failed to update its status. Please try again.', tone: 'danger' });
      // Revert on failure
      setWebhooks(webhooks);
    }
  };

  const handleDelete = async (id: string) => {
    const next = webhooks.filter((w) => w.id !== id);
    // Optimistic update
    setWebhooks(next);

    const res = await apiSaveWebhooks(next);
    if (!res.success) {
      toast({ title: 'Could not delete webhook', description: 'Please try again in a moment.', tone: 'danger' });
      setWebhooks(webhooks);
    } else {
      toast({ title: 'Webhook removed', tone: 'success' });
    }
  };

  const filteredAndSortedWebhooks = useMemo(() => {
    let result = [...webhooks];

    // 1. Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => w.url.toLowerCase().includes(q));
    }

    // 2. Status Filter
    if (statusFilter === 'active') {
      result = result.filter(w => w.active);
    } else if (statusFilter === 'paused') {
      result = result.filter(w => !w.active);
    }

    // 3. Sort
    result.sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortOption === 'az') {
        return a.url.localeCompare(b.url);
      }
      if (sortOption === 'za') {
        return b.url.localeCompare(a.url);
      }
      return 0;
    });

    return result;
  }, [webhooks, searchQuery, statusFilter, sortOption]);

  const stats = useMemo(() => {
    const active = webhooks.filter((w) => w.active).length;
    const events = webhooks.reduce((sum, w) => sum + w.events.length, 0);
    return { total: webhooks.length, active, paused: webhooks.length - active, events };
  }, [webhooks]);

  if (!isMounted) return null; // prevent hydration mismatch

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/url-shortener">URL Shortener</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/url-shortener/settings">Settings</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Webhooks</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageEyebrow>
            <span className="inline-flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" aria-hidden="true" />
              Developer
            </span>
          </PageEyebrow>
          <PageTitle>Webhooks</PageTitle>
          <PageDescription>
            Receive HTTP callbacks when link events occur, so downstream systems stay in sync.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button size="sm" variant="primary" iconLeft={Plus} onClick={() => setShowForm((v) => !v)}>
            Add webhook
          </Button>
        </PageActions>
      </PageHeader>

      {!isLoading && webhooks.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Endpoints"
            value={<span className="tabular-nums">{stats.total}</span>}
            icon={Webhook}
            accent="#3b7af5"
          />
          <StatCard
            label="Active"
            value={<span className="tabular-nums">{stats.active}</span>}
            icon={Zap}
            accent="#1f9d55"
          />
          <StatCard
            label="Paused"
            value={<span className="tabular-nums">{stats.paused}</span>}
            icon={Pause}
            accent="#b78103"
          />
          <StatCard
            label="Event triggers"
            value={<span className="tabular-nums">{stats.events}</span>}
            icon={Radio}
            accent="#7c3aed"
          />
        </div>
      )}

      {showForm && (
        <WebhookForm
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
          isSaving={isSaving}
        />
      )}

      {/* Controls: Search, Filter, Sort */}
      {!isLoading && webhooks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              iconLeft={Search}
              placeholder="Search by URL"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search webhooks by URL"
            />
          </div>

          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOption} onValueChange={(val: any) => setSortOption(val)}>
            <SelectTrigger className="w-[160px]" aria-label="Sort webhooks">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="az">A to Z</SelectItem>
              <SelectItem value="za">Z to A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List / Empty States */}
      {isLoading ? (
        <WebhookSkeleton />
      ) : webhooks.length === 0 && !showForm ? (
        <Card padding="lg">
          <EmptyState
            icon={Webhook}
            title="No webhooks configured"
            description="Add a webhook to receive real-time notifications when link events occur."
            action={
              <Button size="sm" variant="primary" iconLeft={Plus} onClick={() => setShowForm(true)}>
                Add your first webhook
              </Button>
            }
          />
        </Card>
      ) : filteredAndSortedWebhooks.length > 0 ? (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--st-border)]">
            {filteredAndSortedWebhooks.map((w) => (
              <WebhookListItem
                key={w.id}
                webhook={w}
                onToggleActive={toggleActive}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </Card>
      ) : (
        <Card padding="lg">
          <EmptyState
            icon={AlertCircle}
            title="No results found"
            description="Try adjusting your search or filters to find what you're looking for."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
