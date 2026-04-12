'use client';

import Link from 'next/link';
import { ArrowRight, Code, Key, Link as LinkIcon, Puzzle, type LucideIcon } from 'lucide-react';

import {
  SabButton,
  SabCard,
  SabCardBody,
  SabCardHeader,
  SabPageHeader,
  SabPageShell,
} from '@/components/sab-ui';

// Tone subset that matches SabCardGlow — these are the ones the card
// accepts for its colored shadow halo.
type IntegrationTone = 'primary' | 'success' | 'info' | 'danger';

const integrations: {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  tone: IntegrationTone;
}[] = [
  {
    title: 'WhatsApp Link Generator',
    description: 'Create wa.me links with pre-filled messages and track them through UTM parameters.',
    icon: LinkIcon,
    href: '/dashboard/integrations/whatsapp-link-generator',
    tone: 'success',
  },
  {
    title: 'Website Widget',
    description: 'Embed a floating WhatsApp chat widget on your website. Zero dev work, custom branding.',
    icon: Code,
    href: '/dashboard/integrations/whatsapp-widget-generator',
    tone: 'info',
  },
  {
    title: 'Razorpay',
    description: 'Connect your Razorpay account to accept payments directly from WhatsApp messages.',
    icon: Key,
    href: '/dashboard/integrations/razorpay',
    tone: 'primary',
  },
];

function tonePair(tone: IntegrationTone): { bg: string; fg: string } {
  const map: Record<IntegrationTone, { bg: string; fg: string }> = {
    primary: { bg: 'var(--sab-gradient-primary)', fg: '#fff' },
    success: { bg: 'var(--sab-gradient-success)', fg: '#fff' },
    info: { bg: 'var(--sab-gradient-info)', fg: '#fff' },
    danger: { bg: 'var(--sab-gradient-danger)', fg: '#fff' },
  };
  return map[tone];
}

export default function IntegrationsPage() {
  return (
    <SabPageShell>
      <SabPageHeader
        hero
        eyebrow="Wachat · Integrations"
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Integrations' },
        ]}
        title="Integrations"
        description="Plug SabNode into the rest of your stack. Link generators, embeddable widgets, and payment providers — all in one place."
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration, i) => {
          const { bg, fg } = tonePair(integration.tone);
          return (
            <SabCard
              key={integration.href}
              variant={i === 0 ? 'hero' : 'featured'}
              glow={i === 0 ? integration.tone : 'none'}
              interactive
              className="flex flex-col"
            >
              <SabCardHeader
                title={
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]"
                      style={{
                        background: bg,
                        color: fg,
                        boxShadow: `0 8px 18px -6px hsl(var(--sab-${integration.tone}) / 0.40)`,
                      }}
                    >
                      <integration.icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                    </span>
                    <span className="text-[16px] font-semibold">{integration.title}</span>
                  </div>
                }
              />
              <SabCardBody className="flex-1">
                <p
                  className="text-[13.5px] leading-relaxed"
                  style={{ color: 'hsl(var(--sab-fg-muted))' }}
                >
                  {integration.description}
                </p>
              </SabCardBody>
              <div
                className="flex items-center justify-between gap-4 px-6 py-4"
                style={{ borderTop: '1px solid hsl(var(--sab-border))' }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.10em]"
                  style={{ color: 'hsl(var(--sab-fg-subtle))' }}
                >
                  Ready to configure
                </span>
                <Link href={integration.href}>
                  <SabButton variant="primary" size="sm" rightIcon={ArrowRight}>
                    Configure
                  </SabButton>
                </Link>
              </div>
            </SabCard>
          );
        })}
      </div>

      {/* Footer hint card */}
      <SabCard variant="bordered">
        <SabCardBody className="flex items-center gap-4">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[12px]"
            style={{
              background: 'hsl(var(--sab-primary-soft))',
              color: 'hsl(var(--sab-primary))',
            }}
          >
            <Puzzle className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="flex-1">
            <div
              className="text-[14px] font-semibold"
              style={{ color: 'hsl(var(--sab-fg))' }}
            >
              More integrations coming soon
            </div>
            <div
              className="text-[12.5px] leading-snug"
              style={{ color: 'hsl(var(--sab-fg-muted))' }}
            >
              Shopify, HubSpot, Zapier and Stripe are in the works. Need a specific one? Tell us.
            </div>
          </div>
        </SabCardBody>
      </SabCard>
    </SabPageShell>
  );
}
