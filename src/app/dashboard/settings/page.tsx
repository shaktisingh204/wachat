'use client';

import Link from 'next/link';
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

type Tile = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SECTIONS: Array<{ title: string; tiles: Tile[] }> = [
  {
    title: 'Account',
    tiles: [
      {
        href: '/dashboard/settings/profile',
        label: 'Profile',
        description: 'Name, email, avatar, and preferred language.',
        icon: User,
      },
      {
        href: '/dashboard/settings/security',
        label: 'Security',
        description: 'Password, 2FA, and active session management.',
        icon: Shield,
      },
      {
        href: '/dashboard/settings/notifications',
        label: 'Notifications',
        description: 'Choose which events land in your inbox.',
        icon: Bell,
      },
      {
        href: '/dashboard/settings/ui',
        label: 'Appearance',
        description: 'Theme, density, and sidebar behavior.',
        icon: Eye,
      },
    ],
  },
  {
    title: 'Developer',
    tiles: [
      {
        href: '/dashboard/settings/api-keys',
        label: 'API keys',
        description: 'Programmatic access tokens, scoped per workspace.',
        icon: Key,
      },
      {
        href: '/dashboard/settings/webhooks',
        label: 'Webhooks',
        description: 'HTTPS callbacks for events across SabNode modules.',
        icon: Webhook,
      },
      {
        href: '/dashboard/settings/integrations',
        label: 'Integrations',
        description: 'Third-party connections (Stripe, Zapier, Slack).',
        icon: Puzzle,
      },
    ],
  },
  {
    title: 'Billing',
    tiles: [
      {
        href: '/dashboard/settings/billing',
        label: 'Billing & plan',
        description: 'Review your plan, features, and upgrade anytime.',
        icon: CreditCard,
      },
      {
        href: '/dashboard/settings/credits',
        label: 'Credits',
        description: 'Top up or monitor broadcast, SMS, and email credits.',
        icon: Star,
      },
      {
        href: '/dashboard/settings/invoices',
        label: 'Invoices',
        description: 'Download receipts and past billing statements.',
        icon: Receipt,
      },
    ],
  },
];

export default function SettingsOverviewPage() {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Settings</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Settings</ZoruPageTitle>
          <ZoruPageDescription>
            Your account, developer tools, and billing — all in one place. Project-scoped settings
            live inside each module.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="mb-3 text-[13px] uppercase tracking-wide text-zoru-ink-muted">
            {section.title}
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
                      <p className="text-[13.5px] text-zoru-ink">{tile.label}</p>
                      <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                      {tile.description}
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
