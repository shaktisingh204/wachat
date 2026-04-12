'use client';

import Link from 'next/link';
import {
  LuLink,
  LuCode,
  LuKey,
  LuPuzzle,
  LuArrowRight,
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
};

const integrations: Integration[] = [
  {
    title: 'WhatsApp Link Generator',
    description:
      'Create wa.me links with pre-filled messages and track them through UTM parameters.',
    icon: <LuLink className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '/dashboard/integrations/whatsapp-link-generator',
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Website Widget',
    description:
      'Embed a floating WhatsApp chat widget on your website. Zero dev work, custom branding.',
    icon: <LuCode className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '/dashboard/integrations/whatsapp-widget-generator',
    accent: 'bg-sky-50 text-sky-600',
  },
  {
    title: 'Razorpay',
    description:
      'Connect your Razorpay account to accept payments directly from WhatsApp messages.',
    icon: <LuKey className="h-[18px] w-[18px]" strokeWidth={2} />,
    href: '/dashboard/integrations/razorpay',
    accent: 'bg-clay-rose-soft text-clay-rose',
  },
];

/* ── page ──────────────────────────────────────────────────────── */

export default function IntegrationsPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Wachat', href: '/dashboard' },
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
              <h3 className="text-[15px] font-semibold text-clay-ink">
                {integration.title}
              </h3>
            </div>

            <p className="flex-1 text-[13px] leading-relaxed text-clay-ink-muted">
              {integration.description}
            </p>

            <div className="flex items-center justify-between border-t border-clay-border pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-clay-ink-soft">
                Ready to configure
              </span>
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
            </div>
          </ClayCard>
        ))}
      </div>

      {/* Footer hint */}
      <ClayCard variant="soft" className="mt-6 flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay-rose-soft text-clay-rose">
          <LuPuzzle className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-clay-ink">
            More integrations coming soon
          </p>
          <p className="text-[12.5px] leading-snug text-clay-ink-muted">
            Shopify, HubSpot, Zapier and Stripe are in the works. Need a
            specific one? Tell us.
          </p>
        </div>
      </ClayCard>
    </div>
  );
}
