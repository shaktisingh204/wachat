'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  Card,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
import {
  ArrowUpRight,
  Bell,
  CreditCard,
  Database,
  Eye,
  GitBranch,
  Key,
  Puzzle,
  Receipt,
  Shield,
  SlidersHorizontal,
  Star,
  User,
  Users,
  Webhook,
  Zap,
  } from 'lucide-react';

import { useT } from '@/lib/i18n/client';

import Link from 'next/link';

type Tile = {
  href: string;
  /** i18n key for the label; ignored when `label` (a literal) is provided. */
  labelKey?: string;
  /** i18n key for the description; ignored when `description` is provided. */
  descriptionKey?: string;
  /** Literal label, used as-is (for sections without translation keys yet). */
  label?: string;
  /** Literal description, used as-is. */
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SECTIONS: Array<{ titleKey?: string; title?: string; tiles: Tile[] }> = [
  {
    titleKey: 'settings.overview.sections.account',
    tiles: [
      {
        href: '/dashboard/settings/profile',
        labelKey: 'settings.overview.tiles.profile.label',
        descriptionKey: 'settings.overview.tiles.profile.description',
        icon: User,
      },
      {
        href: '/dashboard/settings/security',
        labelKey: 'settings.overview.tiles.security.label',
        descriptionKey: 'settings.overview.tiles.security.description',
        icon: Shield,
      },
      {
        href: '/dashboard/settings/notifications',
        labelKey: 'settings.overview.tiles.notifications.label',
        descriptionKey: 'settings.overview.tiles.notifications.description',
        icon: Bell,
      },
      {
        href: '/dashboard/settings/ui',
        labelKey: 'settings.overview.tiles.appearance.label',
        descriptionKey: 'settings.overview.tiles.appearance.description',
        icon: Eye,
      },
    ],
  },
  {
    titleKey: 'settings.overview.sections.developer',
    tiles: [
      {
        href: '/dashboard/settings/api-keys',
        labelKey: 'settings.overview.tiles.apiKeys.label',
        descriptionKey: 'settings.overview.tiles.apiKeys.description',
        icon: Key,
      },
      {
        href: '/dashboard/settings/webhooks',
        labelKey: 'settings.overview.tiles.webhooks.label',
        descriptionKey: 'settings.overview.tiles.webhooks.description',
        icon: Webhook,
      },
      {
        href: '/dashboard/settings/integrations',
        labelKey: 'settings.overview.tiles.integrations.label',
        descriptionKey: 'settings.overview.tiles.integrations.description',
        icon: Puzzle,
      },
    ],
  },
  {
    titleKey: 'settings.overview.sections.billing',
    tiles: [
      {
        href: '/dashboard/settings/billing',
        labelKey: 'settings.overview.tiles.billing.label',
        descriptionKey: 'settings.overview.tiles.billing.description',
        icon: CreditCard,
      },
      {
        href: '/dashboard/settings/credits',
        labelKey: 'settings.overview.tiles.credits.label',
        descriptionKey: 'settings.overview.tiles.credits.description',
        icon: Star,
      },
      {
        href: '/dashboard/settings/invoices',
        labelKey: 'settings.overview.tiles.invoices.label',
        descriptionKey: 'settings.overview.tiles.invoices.description',
        icon: Receipt,
      },
    ],
  },
  {
    // CRM settings live under /dashboard/settings/crm/* (relocated from
    // /sabcrm/settings/*). Literal labels keep this working without new i18n
    // keys; the linked pages keep their Twenty look via the crm/ layout.
    title: 'CRM',
    tiles: [
      {
        href: '/dashboard/settings/crm',
        label: 'CRM Settings',
        description: 'Full SabCRM workspace configuration',
        icon: SlidersHorizontal,
      },
      {
        href: '/dashboard/settings/crm/data-model',
        label: 'Data model',
        description: 'Objects, fields and relations',
        icon: Database,
      },
      {
        href: '/dashboard/settings/crm/members',
        label: 'Members & Roles',
        description: 'Workspace access and CRM roles',
        icon: Users,
      },
      {
        href: '/dashboard/settings/crm/pipelines',
        label: 'Pipelines',
        description: 'Deal stages and pipeline setup',
        icon: GitBranch,
      },
      {
        href: '/dashboard/settings/crm/automations',
        label: 'Automations',
        description: 'Event-driven rules and actions',
        icon: Zap,
      },
    ],
  },
];

export default function SettingsOverviewPage() {
  const { t } = useT();
  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>{t('settings.overview.title')}</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>{t('settings.overview.title')}</ZoruPageTitle>
          <ZoruPageDescription>
            {t('settings.overview.subtitle')}
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {SECTIONS.map((section) => (
        <div key={section.title ?? section.titleKey}>
          <h2 className="mb-3 text-[13px] uppercase tracking-wide text-zoru-ink-muted">
            {section.title ?? t(section.titleKey!)}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {section.tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link key={tile.href} href={tile.href} className="group">
                  <Card className="h-full p-4 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] text-zoru-ink">
                        {tile.label ?? t(tile.labelKey!)}
                      </p>
                      <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                      {tile.description ?? t(tile.descriptionKey!)}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
