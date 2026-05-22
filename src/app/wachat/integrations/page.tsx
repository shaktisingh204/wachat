'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  ArrowRight,
  Code2,
  FileSpreadsheet,
  KeyRound,
  Link as LinkIcon,
  Puzzle,
  ShoppingBag,
  Store,
  Zap,
  } from 'lucide-react';

import Link from 'next/link';

type Integration = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status: 'ready' | 'coming-soon';
};

const integrations: Integration[] = [
  {
    title: 'WhatsApp link generator',
    description:
      'Create wa.me links with pre-filled messages and track them through UTM parameters.',
    icon: <LinkIcon className="h-[18px] w-[18px]" />,
    href: '/wachat/integrations/whatsapp-link-generator',
    status: 'ready',
  },
  {
    title: 'Website widget',
    description:
      'Embed a floating WhatsApp chat widget on your website. Zero dev work, custom branding.',
    icon: <Code2 className="h-[18px] w-[18px]" />,
    href: '/wachat/integrations/whatsapp-widget-generator',
    status: 'ready',
  },
  {
    title: 'Razorpay',
    description:
      'Connect your Razorpay account to accept payments directly from WhatsApp messages.',
    icon: <KeyRound className="h-[18px] w-[18px]" />,
    href: '/wachat/integrations/razorpay',
    status: 'ready',
  },
  {
    title: 'Shopify',
    description:
      'Sync orders, send abandoned-cart nudges and delivery updates from Shopify to WhatsApp.',
    icon: <ShoppingBag className="h-[18px] w-[18px]" />,
    href: '#',
    status: 'coming-soon',
  },
  {
    title: 'Zapier',
    description:
      'Connect 5,000+ apps to Wachat: trigger broadcasts, sync contacts, log events — no code.',
    icon: <Zap className="h-[18px] w-[18px]" />,
    href: '#',
    status: 'coming-soon',
  },
  {
    title: 'Google Sheets',
    description:
      'Sync contacts to/from a spreadsheet. Two-way updates, column mapping, scheduled pulls.',
    icon: <FileSpreadsheet className="h-[18px] w-[18px]" />,
    href: '#',
    status: 'coming-soon',
  },
  {
    title: 'WooCommerce',
    description: 'Trigger WhatsApp flows on order events: created, paid, shipped, delivered.',
    icon: <Store className="h-[18px] w-[18px]" />,
    href: '#',
    status: 'coming-soon',
  },
];

export default function IntegrationsPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Integrations</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageTitle>Integrations</ZoruPageTitle>
          <ZoruPageDescription>
            Plug SabNode into the rest of your stack. Link generators, embeddable widgets, and
            payment providers.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.title} className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                {integration.icon}
              </span>
              <h3 className="text-[15px] text-zoru-ink">{integration.title}</h3>
            </div>

            <p className="flex-1 text-sm leading-relaxed text-zoru-ink-muted">
              {integration.description}
            </p>

            <div className="flex items-center justify-between border-t border-zoru-line pt-4">
              {integration.status === 'ready' ? (
                <Badge variant="success">Ready to configure</Badge>
              ) : (
                <Badge variant="ghost">Coming soon</Badge>
              )}
              {integration.status === 'ready' ? (
                <Button size="sm" asChild>
                  <Link href={integration.href}>
                    Configure
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Notify me
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
          <Puzzle className="h-[18px] w-[18px]" />
        </span>
        <div className="flex-1">
          <p className="text-[14px] text-zoru-ink">More integrations coming soon</p>
          <p className="text-[12.5px] leading-snug text-zoru-ink-muted">
            Shopify, HubSpot, Zapier and Stripe are in the works. Need a specific one? Tell us.
          </p>
        </div>
      </Card>
    </div>
  );
}
