import {
  Card,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  StatCard,
  Button,
} from '@/components/sabcrm/20ui';
import {
  ArrowUpRight,
  Key,
  KeyRound,
  Boxes,
  Webhook,
  BarChart3,
  FileSearch,
  BookOpen,
  Terminal,
  ShieldCheck,
  Activity,
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

type Accent = 'blue' | 'green' | 'violet' | 'amber';

interface NavCard {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
}

const ACCENT_HEX: Record<Accent, string> = {
  blue: '#3b7af5',
  green: '#1f9d55',
  violet: '#7c3aed',
  amber: '#d97706',
};

const cards: NavCard[] = [
  {
    href: '/dashboard/api/keys',
    title: 'API keys',
    description: 'Tenant-scoped Bearer keys. Use these for server-to-server integrations.',
    icon: Key,
    accent: 'blue',
  },
  {
    href: '/dashboard/api/personal-tokens',
    title: 'Personal Access Tokens',
    description: 'User-scoped tokens that inherit your RBAC. Best for scripts and CI.',
    icon: KeyRound,
    accent: 'violet',
  },
  {
    href: '/dashboard/api/apps',
    title: 'OAuth apps',
    description: 'Register third-party apps and issue scoped tokens via Authorization Code + PKCE.',
    icon: Boxes,
    accent: 'green',
  },
  {
    href: '/dashboard/api/webhooks',
    title: 'Webhooks',
    description: 'Subscribe to events. View deliveries, retry failures, rotate signing secrets.',
    icon: Webhook,
    accent: 'amber',
  },
  {
    href: '/dashboard/api/usage',
    title: 'Usage & analytics',
    description: 'Request counters, top endpoints, latency, error rate — last 24h by default.',
    icon: BarChart3,
    accent: 'blue',
  },
  {
    href: '/dashboard/api/logs',
    title: 'Request log',
    description: 'Every API request your tenant has made in the last 30 days, searchable.',
    icon: FileSearch,
    accent: 'violet',
  },
  {
    href: '/api/docs/modules',
    title: 'API reference',
    description: '1,000+ endpoints across every SabNode module, with code samples in 3 languages.',
    icon: BookOpen,
    accent: 'green',
  },
];

export default function DeveloperApiHubPage(): JSX.Element {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer platform</PageEyebrow>
          <PageTitle>Build on SabNode</PageTitle>
          <PageDescription>
            Everything you need to integrate — keys, OAuth apps, webhooks, usage analytics, and
            live API docs across every module.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild variant="primary">
            <Link href="/dashboard/api/keys">
              <Key className="h-4 w-4" aria-hidden="true" />
              New API key
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/docs/modules">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              API reference
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Developer surfaces"
          value={String(cards.length)}
          icon={<Terminal />}
          accent={ACCENT_HEX.blue}
        />
        <StatCard
          label="Auth methods"
          value="3"
          icon={<ShieldCheck />}
          accent={ACCENT_HEX.green}
        />
        <StatCard
          label="API endpoints"
          value="1,000+"
          icon={<Activity />}
          accent={ACCENT_HEX.violet}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const hex = ACCENT_HEX[card.accent];
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
            >
              <Card
                variant="interactive"
                className="h-full p-5 transition-shadow group-hover:shadow-[var(--st-shadow-md)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)]"
                    style={{ backgroundColor: `${hex}1a`, color: hex }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[var(--st-text-secondary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--st-text)]" />
                </div>
                <p className="mt-3 text-[14px] font-medium text-[var(--st-text)]">{card.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                  {card.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
