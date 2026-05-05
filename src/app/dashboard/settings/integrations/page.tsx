'use client';

import { useState } from 'react';
import {
  Check,
  Database,
  Github,
  Mail,
  Search,
  ShoppingCart,
  Slack,
  Zap,
} from 'lucide-react';

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
  ZoruEmptyState,
  ZoruInput,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  cn,
} from '@/components/zoruui';

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'messaging' | 'data' | 'automation' | 'commerce' | 'dev';
  connected: boolean;
};

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Stream inbox events into a Slack channel for fast team triage.',
    icon: Slack,
    category: 'messaging',
    connected: false,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect SabNode to 6,000+ apps with no-code automations.',
    icon: Zap,
    category: 'automation',
    connected: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Mirror your SabNode release notes to a GitHub repo.',
    icon: Github,
    category: 'dev',
    connected: false,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sync order events into WhatsApp broadcasts and abandoned-cart flows.',
    icon: ShoppingCart,
    category: 'commerce',
    connected: false,
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    description: 'Stream raw message logs into your BigQuery warehouse for analysis.',
    icon: Database,
    category: 'data',
    connected: false,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync contact lists and segments between SabNode and Mailchimp.',
    icon: Mail,
    category: 'messaging',
    connected: false,
  },
];

const CATEGORIES: Array<{ id: Integration['category'] | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'automation', label: 'Automation' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'data', label: 'Data' },
  { id: 'dev', label: 'Developer' },
];

export default function IntegrationsPage() {
  const [filter, setFilter] = useState<Integration['category'] | 'all'>('all');
  const [search, setSearch] = useState('');

  const visible = INTEGRATIONS.filter(
    (i) =>
      (filter === 'all' || i.category === filter) &&
      (!search || i.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Integrations</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Integrations</ZoruPageTitle>
          <ZoruPageDescription>
            Plug SabNode into the tools your team already uses.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-zoru-line bg-zoru-bg p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12.5px] transition-colors',
                filter === c.id
                  ? 'bg-zoru-ink text-zoru-on-primary'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto w-full sm:w-64">
          <ZoruInput
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingSlot={<Search />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((i) => {
          const Icon = i.icon;
          return (
            <ZoruCard key={i.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-5 w-5" />
                </div>
                {i.connected ? (
                  <ZoruBadge variant="success">Connected</ZoruBadge>
                ) : (
                  <ZoruBadge variant="ghost">Available</ZoruBadge>
                )}
              </div>
              <div>
                <p className="text-[14px] text-zoru-ink">{i.name}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {i.description}
                </p>
              </div>
              <div className="mt-auto">
                {i.connected ? (
                  <ZoruButton variant="ghost" size="sm">
                    <Check className="h-4 w-4" /> Manage
                  </ZoruButton>
                ) : (
                  <ZoruButton size="sm">Connect</ZoruButton>
                )}
              </div>
            </ZoruCard>
          );
        })}
      </div>

      {visible.length === 0 && (
        <ZoruEmptyState
          title="No integrations match"
          description="Try a different search or category."
        />
      )}
    </div>
  );
}
