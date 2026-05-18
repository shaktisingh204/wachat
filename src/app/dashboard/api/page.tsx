import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  Key,
  KeyRound,
  Boxes,
  Webhook,
  BarChart3,
  FileSearch,
  BookOpen,
  } from 'lucide-react';

/**
 * Developer platform overview hub.
 *
 * Replaces the legacy keys-only page; keys management lives at
 * /dashboard/api/keys now (a server-rendered list under this hub).
 *
 * Cards link out to every developer-facing surface: keys, PATs, OAuth
 * apps, webhooks, usage analytics, request log, and the in-app API
 * reference.
 */

import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface NavCard {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const cards: NavCard[] = [
  {
    href: '/dashboard/api/keys',
    title: 'API keys',
    description: 'Tenant-scoped Bearer keys. Use these for server-to-server integrations.',
    icon: Key,
  },
  {
    href: '/dashboard/api/personal-tokens',
    title: 'Personal Access Tokens',
    description: 'User-scoped tokens that inherit your RBAC. Best for scripts and CI.',
    icon: KeyRound,
  },
  {
    href: '/dashboard/api/apps',
    title: 'OAuth apps',
    description: 'Register third-party apps and issue scoped tokens via Authorization Code + PKCE.',
    icon: Boxes,
  },
  {
    href: '/dashboard/api/webhooks',
    title: 'Webhooks',
    description: 'Subscribe to events. View deliveries, retry failures, rotate signing secrets.',
    icon: Webhook,
  },
  {
    href: '/dashboard/api/usage',
    title: 'Usage & analytics',
    description: 'Request counters, top endpoints, latency, error rate — last 24h by default.',
    icon: BarChart3,
  },
  {
    href: '/dashboard/api/logs',
    title: 'Request log',
    description: 'Every API request your tenant has made in the last 30 days, searchable.',
    icon: FileSearch,
  },
  {
    href: '/api/docs/modules',
    title: 'API reference',
    description: '1,000+ endpoints across every SabNode module, with code samples in 3 languages.',
    icon: BookOpen,
  },
];

export default function DeveloperApiHubPage(): JSX.Element {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Developer platform</ZoruPageTitle>
          <ZoruPageDescription>
            Everything you need to build on top of SabNode — keys, OAuth apps, webhooks, usage,
            and live API docs.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{card.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {card.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
