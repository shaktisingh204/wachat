'use client';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruCard,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  ArrowUpRight,
  Bell,
  CreditCard,
  Eye,
  Key,
  Puzzle,
  Receipt,
  Shield,
  Star,
  User,
  Webhook,
  } from 'lucide-react';

import { useT } from '@/lib/i18n/client';

import Link from 'next/link';

type Tile = {
  href: string;
  labelKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SECTIONS: Array<{ titleKey: string; tiles: Tile[] }> = [
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
];

export default function SettingsOverviewPage() {
  const { t } = useT();
  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>{t('settings.overview.title')}</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>{t('settings.overview.title')}</ZoruPageTitle>
          <ZoruPageDescription>
            {t('settings.overview.subtitle')}
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {SECTIONS.map((section) => (
        <div key={section.titleKey}>
          <h2 className="mb-3 text-[13px] uppercase tracking-wide text-zoru-ink-muted">
            {t(section.titleKey)}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {section.tiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link key={tile.href} href={tile.href} className="group">
                  <ZoruCard className="h-full p-4 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] text-zoru-ink">{t(tile.labelKey)}</p>
                      <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                      {t(tile.descriptionKey)}
                    </p>
                  </ZoruCard>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
