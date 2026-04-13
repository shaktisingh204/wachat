export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Zap, Mail, Bot, ShoppingCart, CheckCircle, MessageSquare } from 'lucide-react';

import { getIntegrationTypes } from '@/app/actions/crm-integrations.actions';
import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';
import { cn } from '@/lib/utils';

const btnBase =
  'inline-flex h-9 w-full items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium leading-none transition-colors';
const btnObsidian =
  'bg-clay-obsidian text-white hover:bg-clay-obsidian-hover';
const btnRoseSoft =
  'bg-clay-rose-soft text-clay-rose-ink border border-clay-rose-soft hover:brightness-[0.97]';
const btnDisabled =
  'bg-clay-surface text-clay-ink-muted border border-clay-border opacity-60 pointer-events-none';

type IntegrationStatus = 'connected' | 'available' | 'coming_soon';

interface Integration {
  name: string;
  icon: React.ElementType;
  description: string;
  status: IntegrationStatus;
  link?: string;
}

export default async function IntegrationsPage() {
  const status = await getIntegrationTypes();

  const integrations: Integration[] = [
    {
      name: 'Gmail',
      icon: Mail,
      description: 'Sync your emails and contacts directly from Gmail.',
      status: status.gmail ? 'connected' : 'available',
      link: '/dashboard/email/settings',
    },
    {
      name: 'WhatsApp',
      icon: MessageSquare,
      description: 'Connect your WhatsApp Business API for direct messaging.',
      status: status.whatsapp ? 'connected' : 'available',
      link: '/dashboard/settings/whatsapp',
    },
    {
      name: 'Shopify',
      icon: ShoppingCart,
      description: 'Sync customers, products, and orders directly from your Shopify store.',
      status: status.shopify ? 'connected' : 'coming_soon',
    },
    {
      name: 'Zapier',
      icon: Zap,
      description: 'Connect your CRM to thousands of other apps with Zapier automation.',
      status: status.zapier ? 'connected' : 'coming_soon',
    },
    {
      name: 'Slack',
      icon: Bot,
      description: 'Get real-time notifications for new leads, deals, and tasks in Slack.',
      status: status.slack ? 'connected' : 'coming_soon',
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Integrations"
        subtitle="Connect your CRM to other tools and services to streamline your workflow."
        icon={Zap}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const connected = integration.status === 'connected';

          return (
            <ClayCard key={integration.name} className="flex h-full flex-col">
              <div className="flex items-start gap-3">
                <div
                  className={
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-md ' +
                    (connected
                      ? 'bg-clay-green-soft text-clay-green'
                      : 'bg-clay-rose-soft text-clay-rose-ink')
                  }
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14.5px] font-semibold text-clay-ink">
                      {integration.name}
                    </h3>
                    {connected ? (
                      <ClayBadge tone="green" dot>
                        Connected
                      </ClayBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-clay-ink-muted">
                    {integration.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex-1" />

              {connected ? (
                <Link href={integration.link || '#'} className={cn(btnBase, btnRoseSoft)}>
                  Manage
                </Link>
              ) : integration.status === 'available' ? (
                <Link href={integration.link || '#'} className={cn(btnBase, btnObsidian)}>
                  Connect
                </Link>
              ) : (
                <span className={cn(btnBase, btnDisabled)}>Coming Soon</span>
              )}
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}
