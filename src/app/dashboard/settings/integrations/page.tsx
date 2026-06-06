'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, EmptyState, Input, PageDescription, PageHeader, PageHeading, PageTitle, cn } from '@/components/sabcrm/20ui';
import {
  useState } from 'react';
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

import { useT } from '@/lib/i18n/client';

type Integration = {
  id: string;
  name: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'messaging' | 'data' | 'automation' | 'commerce' | 'dev';
  connected: boolean;
};

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    descriptionKey: 'settings.integrations.items.slack.description',
    icon: Slack,
    category: 'messaging',
    connected: false,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    descriptionKey: 'settings.integrations.items.zapier.description',
    icon: Zap,
    category: 'automation',
    connected: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    descriptionKey: 'settings.integrations.items.github.description',
    icon: Github,
    category: 'dev',
    connected: false,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    descriptionKey: 'settings.integrations.items.shopify.description',
    icon: ShoppingCart,
    category: 'commerce',
    connected: false,
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    descriptionKey: 'settings.integrations.items.bigquery.description',
    icon: Database,
    category: 'data',
    connected: false,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    descriptionKey: 'settings.integrations.items.mailchimp.description',
    icon: Mail,
    category: 'messaging',
    connected: false,
  },
];

const CATEGORIES: Array<{ id: Integration['category'] | 'all'; labelKey: string }> = [
  { id: 'all', labelKey: 'settings.integrations.categories.all' },
  { id: 'messaging', labelKey: 'settings.integrations.categories.messaging' },
  { id: 'automation', labelKey: 'settings.integrations.categories.automation' },
  { id: 'commerce', labelKey: 'settings.integrations.categories.commerce' },
  { id: 'data', labelKey: 'settings.integrations.categories.data' },
  { id: 'dev', labelKey: 'settings.integrations.categories.dev' },
];

export default function IntegrationsPage() {
  const { t } = useT();
  const [filter, setFilter] = useState<Integration['category'] | 'all'>('all');
  const [search, setSearch] = useState('');

  const visible = INTEGRATIONS.filter(
    (i) =>
      (filter === 'all' || i.category === filter) &&
      (!search || i.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('settings.integrations.title')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>{t('settings.integrations.title')}</PageTitle>
          <PageDescription>
            {t('settings.integrations.subtitle')}
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12.5px] transition-colors',
                filter === c.id
                  ? 'bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                  : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
              )}
            >
              {t(c.labelKey)}
            </button>
          ))}
        </div>
        <div className="ml-auto w-full sm:w-64">
          <Input
            placeholder={t('settings.integrations.searchPlaceholder')}
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
            <Card key={i.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                  <Icon className="h-5 w-5" />
                </div>
                {i.connected ? (
                  <Badge variant="success">{t('settings.integrations.status.connected')}</Badge>
                ) : (
                  <Badge variant="ghost">{t('settings.integrations.status.available')}</Badge>
                )}
              </div>
              <div>
                <p className="text-[14px] text-[var(--st-text)]">{i.name}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                  {t(i.descriptionKey)}
                </p>
              </div>
              <div className="mt-auto">
                {i.connected ? (
                  <Button variant="ghost" size="sm">
                    <Check className="h-4 w-4" /> {t('settings.integrations.manage')}
                  </Button>
                ) : (
                  <Button size="sm">{t('action.connect')}</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {visible.length === 0 && (
        <EmptyState
          title={t('settings.integrations.empty.title')}
          description={t('settings.integrations.empty.description')}
        />
      )}
    </div>
  );
}
