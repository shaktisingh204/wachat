'use client';

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
} from '@/components/sabcrm/20ui/compat';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarRange,
  FlaskConical,
  Layers,
  Megaphone,
  Plus,
  Settings as SettingsIcon,
  Target,
  Wallet,
  Zap,
  } from 'lucide-react';

/**
 * /dashboard/facebook/ads — Facebook Ads landing inside the Meta Suite.
 *
 * The full ads workspace lives at /dashboard/ad-manager. This landing
 * page is a quick-jump hub for the most-used surfaces so operators
 * working in Meta Suite don't have to switch contexts.
 */

import * as React from 'react';
import Link from 'next/link';

interface Tile {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const TILES: Tile[] = [
  {
    key: 'overview',
    label: 'Ads overview',
    description: 'Account-level KPIs and top campaigns.',
    href: '/dashboard/ad-manager',
    icon: <Megaphone />,
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    description: 'Create, pause, and edit campaigns.',
    href: '/dashboard/ad-manager/campaigns',
    icon: <Briefcase />,
  },
  {
    key: 'ad-sets',
    label: 'Ad sets',
    description: 'Targeting, schedule, and budget per ad set.',
    href: '/dashboard/ad-manager/ad-sets',
    icon: <Layers />,
  },
  {
    key: 'ads',
    label: 'Ads',
    description: 'Individual ad creatives and previews.',
    href: '/dashboard/ad-manager/ads',
    icon: <Target />,
  },
  {
    key: 'audiences',
    label: 'Audiences',
    description: 'Custom & lookalike audience management.',
    href: '/dashboard/ad-manager/audiences',
    icon: <Target />,
  },
  {
    key: 'insights',
    label: 'Insights',
    description: 'Performance breakdowns and attribution.',
    href: '/dashboard/ad-manager/insights',
    icon: <BarChart3 />,
  },
  {
    key: 'rules',
    label: 'Automated rules',
    description: 'Alerts and auto-actions on campaign metrics.',
    href: '/dashboard/ad-manager/automated-rules',
    icon: <Zap />,
  },
  {
    key: 'split',
    label: 'Split tests',
    description: 'A/B test creative, audience, or placement.',
    href: '/dashboard/ad-manager/split-tests',
    icon: <FlaskConical />,
  },
  {
    key: 'budget',
    label: 'Budget optimizer',
    description: 'Reallocate spend toward winning ad sets.',
    href: '/dashboard/ad-manager/budget-optimizer',
    icon: <Wallet />,
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Calendar view of campaign run-dates.',
    href: '/dashboard/ad-manager/calendar',
    icon: <CalendarRange />,
  },
  {
    key: 'settings',
    label: 'Account settings',
    description: 'Ad accounts, billing, and pixels.',
    href: '/dashboard/ad-manager/settings',
    icon: <SettingsIcon />,
  },
];

export default function FacebookAdsPage(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Ads</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Facebook Ads</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Quick-access tiles into the full Ads Manager workspace.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/ad-manager/create">
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Card key={t.key} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] [&_svg]:size-4">
                {t.icon}
              </div>
              <p className="text-sm text-[var(--st-text)]">{t.label}</p>
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">{t.description}</p>
            <footer className="flex items-center justify-between border-t border-[var(--st-border)] pt-3">
              <Badge variant="ghost">live</Badge>
              <Button asChild variant="ghost" size="sm">
                <Link href={t.href} className="inline-flex items-center">
                  Open
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </footer>
          </Card>
        ))}
      </div>
    </div>
  );
}
