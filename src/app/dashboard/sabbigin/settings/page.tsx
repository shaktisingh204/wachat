import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AtSign,
  CalendarClock,
  ChevronRight,
  Inbox,
  KeyRound,
  Mail,
  Plug,
  SlidersHorizontal,
  Users,
  Webhook as WebhookIcon,
} from 'lucide-react';

import {
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSabbiginConfig } from '@/app/actions/sabbigin.actions';
import { sabbiginCurrency } from '@/lib/sabbigin/config-helpers';
import { GeneralSettingsForm } from './_components/general-settings-form';

export const dynamic = 'force-dynamic';

interface SettingsLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const SETTINGS_LINKS: SettingsLink[] = [
  {
    href: '/dashboard/sabbigin/settings/fields',
    title: 'Custom fields',
    description: 'Add fields to deals, contacts, and companies.',
    icon: SlidersHorizontal,
  },
  {
    href: '/dashboard/sabbigin/settings/email',
    title: 'Email',
    description: 'Connect sending, set your from-name and signature.',
    icon: Mail,
  },
  {
    href: '/dashboard/sabbigin/settings/team',
    title: 'Team & pipelines',
    description: 'Pipelines, stages, and visibility for your team.',
    icon: Users,
  },
  {
    href: '/dashboard/sabbigin/settings/forms',
    title: 'Web forms',
    description: 'Lead-capture forms with copy-link and embed snippets.',
    icon: Inbox,
  },
  {
    href: '/dashboard/sabbigin/settings/booking',
    title: 'Booking pages',
    description: 'Let people book time directly on your calendar.',
    icon: CalendarClock,
  },
  {
    href: '/dashboard/sabbigin/settings/email-in',
    title: 'Email-In',
    description: 'Turn an address into a pipeline inbox via SabMail.',
    icon: AtSign,
  },
  {
    href: '/dashboard/sabbigin/settings/integrations',
    title: 'Integrations',
    description: 'WhatsApp, automations, sheets, and email.',
    icon: Plug,
  },
  {
    href: '/dashboard/sabbigin/settings/api',
    title: 'API & webhooks',
    description: 'API keys, webhooks, REST endpoints, and MCP.',
    icon: KeyRound,
  },
];

export default async function SabbiginSettingsPage() {
  const [config, pipelines] = await Promise.all([
    getSabbiginConfig(),
    getCrmPipelines(),
  ]);

  const branding = config?.publicBranding ?? null;

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin</PageEyebrow>
          <PageTitle>Settings</PageTitle>
          <PageDescription>
            Configure your CRM defaults, branding, custom fields, capture
            surfaces, and developer access.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Subpage navigation grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="block">
              <Card className="h-full transition-colors hover:border-[var(--st-border-strong)]">
                <CardBody className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/12 text-[var(--st-accent)]"
                    aria-hidden="true"
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--st-text)]">
                      {link.title}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]"
                        aria-hidden="true"
                      />
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                      {link.description}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* General section */}
      <GeneralSettingsForm
        configId={config?._id || null}
        currency={sabbiginCurrency(config)}
        defaultPipelineId={config?.pipelineId ?? null}
        companyName={branding?.companyName ?? ''}
        logoUrl={branding?.logoUrl ?? null}
        accentColor={branding?.accentColor ?? '#3b7af5'}
        pipelines={pipelines.map((p) => ({ id: String(p.id), name: p.name }))}
      />
    </div>
  );
}
