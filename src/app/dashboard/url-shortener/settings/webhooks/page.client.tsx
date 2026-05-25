'use client';

import { useState, useEffect, useMemo } from 'react';
import { fmtDate } from "@/lib/utils";
import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Switch,
  useZoruToast,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/zoruui';
import { Plus, Trash2, Webhook, Search, AlertCircle } from 'lucide-react';

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
    }, 600); // Artificial delay for skeleton loading
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
    }, 400); // Artificial delay for saving
  });
};

// --- Sub-Components ---

function WebhookSkeleton() {
  return (
    <Card className="p-0">
      <ul className="divide-y divide-zoru-line">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-8 w-8 rounded" />
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
  const { toast } = useZoruToast();
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<Set<WebhookEvent>>(new Set());

  const handleSave = () => {
    if (!/^https:\/\//.test(formUrl)) {
      toast({ title: 'Invalid URL', description: 'Endpoint must start with https://', variant: 'destructive' });
      return;
    }
    if (formEvents.size === 0) {
      toast({ title: 'No events selected', description: 'Select at least one event.', variant: 'destructive' });
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
    <Card className="p-5 space-y-4">
      <h3 className="text-[14px] text-zoru-ink font-semibold">New Webhook Config</h3>
      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-zoru-ink-muted">Endpoint URL</Label>
        <Input
          placeholder="https://yourserver.com/webhook"
          value={formUrl}
          onChange={(e) => setFormUrl(e.target.value)}
          disabled={isSaving}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12.5px] text-zoru-ink-muted">Secret (Optional)</Label>
        <Input
          placeholder="Signing secret for payload verification"
          value={formSecret}
          onChange={(e) => setFormSecret(e.target.value)}
          disabled={isSaving}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[12.5px] text-zoru-ink-muted">Triggers</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((ev) => {
            const on = formEvents.has(ev);
            return (
              <button
                key={ev}
                type="button"
                onClick={() => toggleEvent(ev)}
                disabled={isSaving}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  on
                    ? 'border-zoru-ink bg-zoru-ink text-zoru-bg'
                    : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink'
                } disabled:opacity-50`}
              >
                {ev}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Webhook'}
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
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-zoru-surface/50 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="truncate text-[14px] text-zoru-ink font-medium">{webhook.url}</span>
          {webhook.active ? (
            <Badge variant="success" className="text-[10px] py-0 h-5">Active</Badge>
          ) : (
            <Badge variant="ghost" className="text-[10px] py-0 h-5">Paused</Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {webhook.events.map((ev) => (
            <Badge key={ev} variant="outline" className="text-[10.5px]">{ev}</Badge>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-zoru-ink-muted flex items-center gap-1">
          <span>Created: {fmtDate(webhook.createdAt)}</span>
          {webhook.secret && (
            <>
              <span className="mx-1">•</span>
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
        <button
          type="button"
          onClick={() => onDelete(webhook.id)}
          className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-danger/10 hover:text-zoru-danger-ink transition-colors"
          aria-label="Delete webhook"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

export default function UrlShortenerWebhooksPage() {
  const { toast } = useZoruToast();
  
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
      toast({ title: 'Error', description: res.error || 'Failed to load webhooks', variant: 'destructive' });
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
      toast({ title: 'Error', description: res.error || 'Failed to save', variant: 'destructive' });
    } else {
      setWebhooks(res.data || []);
      setShowForm(false);
      toast({ title: 'Webhook added successfully' });
    }
  };

  const toggleActive = async (id: string) => {
    const next = webhooks.map((w) => (w.id === id ? { ...w, active: !w.active } : w));
    // Optimistic update
    setWebhooks(next);
    
    const res = await apiSaveWebhooks(next);
    if (!res.success) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
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
      toast({ title: 'Error', description: 'Failed to delete webhook', variant: 'destructive' });
      setWebhooks(webhooks);
    } else {
      toast({ title: 'Webhook removed' });
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

  if (!isMounted) return null; // Prevent hydration mismatch

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
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
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Webhooks</ZoruPageTitle>
            <ZoruPageDescription>
              Receive HTTP callbacks when link events occur. Keep your CRM up to date in real-time.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Webhook
        </Button>
      </div>

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
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <Input 
              placeholder="Search by URL..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOption} onValueChange={(val: any) => setSortOption(val)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="az">A-Z</SelectItem>
              <SelectItem value="za">Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List / Empty States */}
      {isLoading ? (
        <WebhookSkeleton />
      ) : webhooks.length === 0 && !showForm ? (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
            <Webhook className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-zoru-ink">No webhooks configured</p>
          <p className="mt-1 text-xs text-zoru-ink-muted">
            Add a webhook to receive real-time notifications when link events occur.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> Configure First Webhook
          </Button>
        </Card>
      ) : filteredAndSortedWebhooks.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-zoru-line">
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
        <Card className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-zoru-ink">No results found</p>
          <p className="mt-1 text-xs text-zoru-ink-muted">
            Try adjusting your search or filters to find what you're looking for.
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}>
            Clear Filters
          </Button>
        </Card>
      )}
    </div>
  );
}

