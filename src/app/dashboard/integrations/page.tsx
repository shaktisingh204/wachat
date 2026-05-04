'use client';

import Link from 'next/link';
import {
  LuLink,
  LuCode,
  LuKey,
  LuPuzzle,
  LuArrowRight,
  LuShoppingBag,
  LuZap,
  LuFileSpreadsheet,
  LuStore,
} from 'react-icons/lu';

import {
  ClayBreadcrumbs,
  ClayCard,
  ClayButton,
  ClaySectionHeader,
} from '@/components/clay';

/* ── integration registry ─────────────────────────────────────── */

type Integration = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  accent: string; // tailwind bg class for the icon badge
  status: 'ready' | 'coming-soon';
};

const integrations: Integration[] = [
  {
    title: 'WhatsApp Link Generator',
    description:
      'Create wa.me links with pre-filled messages and track them through UTM parameters.',
    icon: <LuLink className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '/dashboard/integrations/whatsapp-link-generator',
    accent: 'bg-emerald-50 text-emerald-600',
    status: 'ready',
  },
  {
    title: 'Website Widget',
    description:
      'Embed a floating WhatsApp chat widget on your website. Zero dev work, custom branding.',
    icon: <LuCode className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '/dashboard/integrations/whatsapp-widget-generator',
    accent: 'bg-sky-50 text-sky-600',
    status: 'ready',
  },
  {
    title: 'Razorpay',
    description:
      'Connect your Razorpay account to accept payments directly from WhatsApp messages.',
    icon: <LuKey className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '/dashboard/integrations/razorpay',
    accent: 'bg-accent text-primary',
    status: 'ready',
  },
  {
    title: 'Shopify',
    description: 'Sync orders, send abandoned-cart nudges and delivery updates from Shopify to WhatsApp.',
    icon: <LuShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '#',
    accent: 'bg-lime-50 text-lime-700',
    status: 'coming-soon',
  },
  {
    title: 'Zapier',
    description: 'Connect 5,000+ apps to Wachat: trigger broadcasts, sync contacts, log events — no code.',
    icon: <LuZap className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '#',
    accent: 'bg-orange-50 text-orange-600',
    status: 'coming-soon',
  },
  {
    title: 'Google Sheets',
    description: 'Sync contacts to/from a spreadsheet. Two-way updates, column mapping, scheduled pulls.',
    icon: <LuFileSpreadsheet className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '#',
    accent: 'bg-emerald-50 text-emerald-600',
    status: 'coming-soon',
  },
  {
    title: 'WooCommerce',
    description: 'Trigger WhatsApp flows on order events: created, paid, shipped, delivered.',
    icon: <LuStore className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '#',
    accent: 'bg-purple-50 text-purple-600',
    status: 'coming-soon',
  },
];

/* ── page ──────────────────────────────────────────────────────── */

export default function IntegrationsPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'Wachat', href: '/wachat' },
          { label: 'Integrations' },
        ]}
      />

      <ClaySectionHeader
        title="Integrations"
        subtitle="Plug SabNode into the rest of your stack. Link generators, embeddable widgets, and payment providers."
        size="lg"
        className="mt-5"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <ClayCard
            key={integration.href}
            className="flex flex-col gap-4 p-5"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${integration.accent}`}
              >
                {integration.icon}
              </span>
              <h3 className="text-[15px] font-semibold text-foreground">
                {integration.title}
              </h3>
            </div>

            <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
              {integration.description}
            </p>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.10em] ${
                  integration.status === 'ready' ? 'text-emerald-600' : 'text-muted-foreground'
                }`}
              >
                {integration.status === 'ready' ? 'Ready to configure' : 'Coming soon'}
              </span>
              {integration.status === 'ready' ? (
                <Link href={integration.href}>
                  <ClayButton
                    variant="obsidian"
                    size="sm"
                    trailing={
                      <LuArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    }
                  >
                    Configure
                  </ClayButton>
                </Link>
              ) : (
                <ClayButton variant="pill" size="sm" disabled>
                  Notify me
                </ClayButton>
              )}
            </div>
          </ClayCard>
        ))}
      </div>

      {/* Footer hint */}
      <ClayCard variant="soft" className="mt-6 flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <LuPuzzle className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-foreground">
            More integrations coming soon
          </p>
          <p className="text-[12.5px] leading-snug text-muted-foreground">
            Shopify, HubSpot, Zapier and Stripe are in the works. Need a
            specific one? Tell us.
          </p>
        </div>
      </ClayCard>
    </div>
  );
}
