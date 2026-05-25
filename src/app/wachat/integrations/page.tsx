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
  ZoruTable,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
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
  Globe,
  PieChart,
  Plus,
  Trash2,
  Edit2,
  Copy,
} from 'lucide-react';

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Integration = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
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
    status: 'coming-soon',
  },
  {
    title: 'Zapier',
    description:
      'Connect 5,000+ apps to Wachat: trigger broadcasts, sync contacts, log events — no code.',
    icon: <Zap className="h-[18px] w-[18px]" />,
    status: 'coming-soon',
  },
  {
    title: 'Google Sheets',
    description:
      'Sync contacts to/from a spreadsheet. Two-way updates, column mapping, scheduled pulls.',
    icon: <FileSpreadsheet className="h-[18px] w-[18px]" />,
    status: 'coming-soon',
  },
  {
    title: 'WooCommerce',
    description: 'Trigger WhatsApp flows on order events: created, paid, shipped, delivered.',
    icon: <Store className="h-[18px] w-[18px]" />,
    status: 'coming-soon',
  },
];

const oauthConnections = [
  {
    name: 'Facebook / Meta',
    description: 'Connect your WhatsApp Business Account (WABA)',
    icon: <Globe className="h-[18px] w-[18px]" />,
    status: 'connected',
    connectedAt: 'Dec 1, 2023',
  },
  {
    name: 'Shopify',
    description: 'Sync your products and customers',
    icon: <ShoppingBag className="h-[18px] w-[18px]" />,
    status: 'disconnected',
  },
  {
    name: 'Google Analytics',
    description: 'Track WhatsApp link clicks and widget interactions',
    icon: <PieChart className="h-[18px] w-[18px]" />,
    status: 'disconnected',
  }
];

const webhooks = [
  {
    id: 'wh_123',
    url: 'https://api.myapp.com/webhooks/whatsapp',
    events: ['message.received', 'message.status'],
    status: 'active',
    createdAt: 'Nov 15, 2023',
  },
  {
    id: 'wh_124',
    url: 'https://hooks.zapier.com/hooks/catch/12345/abcde/',
    events: ['contact.created'],
    status: 'inactive',
    createdAt: 'Oct 20, 2023',
  }
];

const apiKeys = [
  {
    id: 'key_1',
    name: 'Production API Key',
    key: 'sk_live_••••••••9f8a',
    createdAt: 'Nov 10, 2023',
    lastUsed: 'May 24, 2024',
  },
  {
    id: 'key_2',
    name: 'Development API Key',
    key: 'sk_test_••••••••3b2c',
    createdAt: 'Jan 5, 2024',
    lastUsed: 'Never',
  }
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

      <Tabs defaultValue="integrations" className="mt-6 w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="integrations">App Integrations</TabsTrigger>
          <TabsTrigger value="oauth">OAuth Connections</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks & API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-0 outline-none">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  {integration.status === 'ready' && integration.href ? (
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
        </TabsContent>

        <TabsContent value="oauth" className="mt-0 outline-none">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {oauthConnections.map((app) => (
              <Card key={app.name} className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                    {app.icon}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-medium text-zoru-ink">{app.name}</h3>
                    <p className="text-sm text-zoru-ink-muted">{app.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {app.status === 'connected' ? (
                    <>
                      <div className="flex flex-col items-end">
                        <Badge variant="success">Connected</Badge>
                        <span className="mt-1 text-[11px] text-zoru-ink-muted">Since {app.connectedAt}</span>
                      </div>
                      <Button size="sm" variant="outline">Disconnect</Button>
                    </>
                  ) : (
                    <Button size="sm">Connect</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-0 outline-none">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-zoru-ink">Webhooks</h3>
                  <p className="text-sm text-zoru-ink-muted">Manage webhook endpoints to receive real-time updates.</p>
                </div>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Webhook
                </Button>
              </div>
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>URL</ZoruTableHead>
                    <ZoruTableHead>Events</ZoruTableHead>
                    <ZoruTableHead>Status</ZoruTableHead>
                    <ZoruTableHead>Created</ZoruTableHead>
                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {webhooks.map((wh) => (
                    <ZoruTableRow key={wh.id}>
                      <ZoruTableCell className="font-medium">{wh.url}</ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="secondary" className="text-[10px] uppercase font-medium">{ev}</Badge>
                          ))}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {wh.status === 'active' ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="ghost">Inactive</Badge>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">{wh.createdAt}</ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-zoru-ink">API Keys</h3>
                  <p className="text-sm text-zoru-ink-muted">Manage API keys to authenticate your API requests.</p>
                </div>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Key
                </Button>
              </div>
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Name</ZoruTableHead>
                    <ZoruTableHead>Key</ZoruTableHead>
                    <ZoruTableHead>Created At</ZoruTableHead>
                    <ZoruTableHead>Last Used</ZoruTableHead>
                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {apiKeys.map((k) => (
                    <ZoruTableRow key={k.id}>
                      <ZoruTableCell className="font-medium">{k.name}</ZoruTableCell>
                      <ZoruTableCell className="font-mono text-xs">{k.key}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">{k.createdAt}</ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">{k.lastUsed}</ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
