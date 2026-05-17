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
import { Key, KeyRound, Boxes, Webhook, BarChart3, FileSearch, BookOpen } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Developer platform</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Everything you need to build on top of SabNode — keys, OAuth apps, webhooks, usage,
          and live API docs.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="block p-5 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-amber-500/40 transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5 text-amber-400" />
                <div className="font-semibold text-zinc-100">{card.title}</div>
              </div>
              <p className="text-xs text-zinc-400">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
