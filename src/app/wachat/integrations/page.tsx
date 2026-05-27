'use client';

import * as React from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Edit2,
  FileSpreadsheet,
  Globe,
  Layers,
  Link as LinkIcon,
  PieChart,
  Plus,
  Puzzle,
  Send,
  ShoppingBag,
  Store,
  Trash2,
  Zap,
} from 'lucide-react';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  StatusPill,
  Tabs,
  type TabSpec,
  DataRow,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/* ------------------------------------------------------------------ */
/* Static data                                                        */
/* ------------------------------------------------------------------ */

type IntegrationStatus = 'ready' | 'coming-soon';

interface IntegrationCard {
  title: string;
  description: string;
  href?: string;
  status: IntegrationStatus;
  /** Brand slug for the simpleicons CDN, or a Lucide icon as fallback. */
  brand?: string;
  fallbackIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const integrations: IntegrationCard[] = [
  {
    title: 'WhatsApp link generator',
    description: 'Create wa.me links with pre-filled messages and UTM tracking.',
    href: '/wachat/integrations/whatsapp-link-generator',
    status: 'ready',
    brand: 'whatsapp',
    fallbackIcon: LinkIcon,
  },
  {
    title: 'Website widget',
    description: 'Embed a floating WhatsApp chat widget on your website. Zero dev work.',
    href: '/wachat/integrations/whatsapp-widget-generator',
    status: 'ready',
    fallbackIcon: Code2,
  },
  {
    title: 'Razorpay',
    description: 'Connect Razorpay to accept payments directly from WhatsApp messages.',
    href: '/wachat/integrations/razorpay',
    status: 'ready',
    brand: 'razorpay',
  },
  {
    title: 'Shopify',
    description: 'Sync orders, send abandoned-cart nudges, and delivery updates.',
    status: 'coming-soon',
    brand: 'shopify',
    fallbackIcon: ShoppingBag,
  },
  {
    title: 'Zapier',
    description: '5,000+ apps to Wachat. Trigger broadcasts, sync contacts, log events.',
    status: 'coming-soon',
    brand: 'zapier',
    fallbackIcon: Zap,
  },
  {
    title: 'Google Sheets',
    description: 'Two-way contact sync with a spreadsheet. Column mapping, scheduled pulls.',
    status: 'coming-soon',
    brand: 'googlesheets',
    fallbackIcon: FileSpreadsheet,
  },
  {
    title: 'WooCommerce',
    description: 'Trigger WhatsApp flows on order events: created, paid, shipped, delivered.',
    status: 'coming-soon',
    brand: 'woocommerce',
    fallbackIcon: Store,
  },
];

const oauthConnections: {
  name: string;
  description: string;
  brand?: string;
  fallback: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  connected: boolean;
  connectedAt?: string;
}[] = [
  {
    name: 'Facebook / Meta',
    description: 'Connect your WhatsApp Business Account (WABA).',
    brand: 'meta',
    fallback: Globe,
    connected: true,
    connectedAt: 'Dec 1, 2024',
  },
  {
    name: 'Shopify',
    description: 'Sync products and customers.',
    brand: 'shopify',
    fallback: ShoppingBag,
    connected: false,
  },
  {
    name: 'Google Analytics',
    description: 'Track WhatsApp link clicks and widget interactions.',
    brand: 'googleanalytics',
    fallback: PieChart,
    connected: false,
  },
];

const webhookSamples = [
  {
    id: 'wh_123',
    url: 'https://api.myapp.com/webhooks/whatsapp',
    events: ['message.received', 'message.status'],
    status: 'active' as const,
    createdAt: 'Nov 15, 2024',
  },
  {
    id: 'wh_124',
    url: 'https://hooks.zapier.com/hooks/catch/12345/abcde/',
    events: ['contact.created'],
    status: 'inactive' as const,
    createdAt: 'Oct 20, 2024',
  },
];

const apiKeys = [
  {
    id: 'key_1',
    name: 'Production API key',
    key: 'sk_live_••••••••9f8a',
    createdAt: 'Nov 10, 2024',
    lastUsed: 'May 24, 2026',
  },
  {
    id: 'key_2',
    name: 'Development API key',
    key: 'sk_test_••••••••3b2c',
    createdAt: 'Jan 5, 2026',
    lastUsed: 'Never',
  },
];

/* ------------------------------------------------------------------ */
/* Brand-logo helper                                                  */
/* ------------------------------------------------------------------ */

function BrandLogo({
  brand,
  fallback: Fallback,
  className = 'h-5 w-5',
}: {
  brand?: string;
  fallback?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  if (brand && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://cdn.simpleicons.org/${brand}/000000`}
        alt=""
        aria-hidden
        className={className}
        onError={() => setErrored(true)}
      />
    );
  }
  if (Fallback) return <Fallback className={className} strokeWidth={2} />;
  return <Puzzle className={className} strokeWidth={2} />;
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

const TABS: TabSpec[] = [
  { id: 'apps', label: 'App integrations' },
  { id: 'oauth', label: 'OAuth connections' },
  { id: 'webhooks', label: 'Webhooks and keys' },
];

export default function IntegrationsPage() {
  const [tab, setTab] = React.useState<string>('apps');
  const reduce = useReducedMotion();

  return (
    <WaPage>
      <PageHeader
        title="Integrations"
        description="Plug SabNode into the rest of your stack. Link generators, embeddable widgets, and payment providers."
        kicker="Wachat · integrations"
        backHref="/wachat"
        eyebrowIcon={Puzzle}
      />

      {/* KPI strip — purely derived from local config (no fake metrics). */}
      {(() => {
        const total = integrations.length;
        const ready = integrations.filter((i) => i.status === 'ready').length;
        const comingSoon = total - ready;
        const oauthConnected = oauthConnections.filter((o) => o.connected).length;
        const activeWebhooks = webhookSamples.filter((w) => w.status === 'active').length;
        const keys = apiKeys.length;
        return (
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile label="Total apps" value={total} icon={Layers} delay={0.02} />
            <MetricTile label="Ready" value={ready} icon={CheckCircle2} delay={0.04} />
            <MetricTile label="Coming soon" value={comingSoon} icon={Clock} delay={0.06} />
            <MetricTile label="OAuth linked" value={oauthConnected} icon={Activity} delay={0.08} />
            <MetricTile label="Live webhooks" value={activeWebhooks} icon={Send} delay={0.1} />
            <MetricTile label="API keys" value={keys} icon={AlertTriangle} delay={0.12} />
          </section>
        );
      })()}

      <Tabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'apps' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration, i) => (
              <m.div
                key={integration.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
                className="flex h-24 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 14px 32px -22px var(--mt-accent-glow)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white">
                  <BrandLogo brand={integration.brand} fallback={integration.fallbackIcon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-950">
                      {integration.title}
                    </h3>
                    {integration.status === 'ready' ? (
                      <StatusPill tone="live">Ready</StatusPill>
                    ) : (
                      <StatusPill tone="paused">Soon</StatusPill>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-zinc-500">
                    {integration.description}
                  </p>
                </div>
                {integration.status === 'ready' && integration.href ? (
                  <WaButton href={integration.href} size="sm" rightIcon={ArrowRight}>
                    Open
                  </WaButton>
                ) : (
                  <WaButton size="sm" variant="outline" disabled>
                    Notify
                  </WaButton>
                )}
              </m.div>
            ))}
          </div>

          <Section padded={false}>
            <div className="flex items-center gap-4 p-5">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: 'var(--mt-accent-soft)' }}
              >
                <Puzzle className="h-5 w-5" style={{ color: 'var(--mt-accent)' }} strokeWidth={2} />
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-zinc-950">More integrations on the way</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-600">
                  HubSpot, Stripe, and a public webhook beta are next. Need a specific one? Tell us.
                </p>
              </div>
              <WaButton variant="outline" size="sm" rightIcon={ArrowUpRight}>
                Request
              </WaButton>
            </div>
          </Section>
        </div>
      )}

      {tab === 'oauth' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {oauthConnections.map((app, i) => (
            <m.div
              key={app.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.05, ease: EASE_OUT }}
              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-200">
                  <BrandLogo brand={app.brand} fallback={app.fallback} className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[14.5px] font-semibold tracking-tight text-zinc-950">{app.name}</h3>
                  <p className="mt-0.5 text-[12.5px] text-zinc-600">{app.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {app.connected ? (
                  <>
                    <div className="hidden flex-col items-end sm:flex">
                      <StatusPill tone="live">Connected</StatusPill>
                      <span className="mt-1 text-[10.5px] text-zinc-500">Since {app.connectedAt}</span>
                    </div>
                    <WaButton size="sm" variant="outline">
                      Disconnect
                    </WaButton>
                  </>
                ) : (
                  <WaButton size="sm">Connect</WaButton>
                )}
              </div>
            </m.div>
          ))}
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-6">
          <Section
            title="Webhooks"
            description="Manage webhook endpoints to receive real-time updates."
            action={<WaButton size="sm" leftIcon={Plus}>Add webhook</WaButton>}
          >
            {webhookSamples.length === 0 ? (
              <p className="px-1 py-2 text-[13px] text-zinc-500">No webhooks configured.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {webhookSamples.map((wh) => (
                  <DataRow
                    key={wh.id}
                    title={<span className="font-mono">{wh.url}</span>}
                    subtitle={
                      <span className="flex flex-wrap items-center gap-1.5">
                        {wh.events.map((ev) => (
                          <span
                            key={ev}
                            className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600"
                          >
                            {ev}
                          </span>
                        ))}
                        <span className="text-zinc-400">· {wh.createdAt}</span>
                      </span>
                    }
                    trailing={
                      <div className="flex items-center gap-1">
                        {wh.status === 'active' ? (
                          <StatusPill tone="live">Active</StatusPill>
                        ) : (
                          <StatusPill tone="paused">Inactive</StatusPill>
                        )}
                        <button className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Edit">
                          <Edit2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                        <button className="grid h-7 w-7 place-items-center rounded-full text-rose-500 hover:bg-rose-50" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </div>
                    }
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="API keys"
            description="Manage API keys to authenticate your requests."
            action={<WaButton size="sm" leftIcon={Plus}>Generate key</WaButton>}
          >
            <ul className="divide-y divide-zinc-100">
              {apiKeys.map((k) => (
                <DataRow
                  key={k.id}
                  title={k.name}
                  subtitle={<span className="font-mono">{k.key}</span>}
                  trailing={
                    <div className="flex items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-400">Last used</p>
                        <p className="font-mono text-[11.5px] text-zinc-600">{k.lastUsed}</p>
                      </div>
                      <button className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Copy">
                        <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                      <button className="grid h-7 w-7 place-items-center rounded-full text-rose-500 hover:bg-rose-50" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  }
                />
              ))}
            </ul>
          </Section>
        </div>
      )}
    </WaPage>
  );
}
