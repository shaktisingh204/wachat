'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  IconButton,
  Tabs,
  TabPanel,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
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

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

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
    icon: <LinkIcon className="h-[18px] w-[18px]" aria-hidden="true" />,
    href: '/wachat/integrations/whatsapp-link-generator',
    status: 'ready',
  },
  {
    title: 'Website widget',
    description:
      'Embed a floating WhatsApp chat widget on your website. Zero dev work, custom branding.',
    icon: <Code2 className="h-[18px] w-[18px]" aria-hidden="true" />,
    href: '/wachat/integrations/whatsapp-widget-generator',
    status: 'ready',
  },
  {
    title: 'Razorpay',
    description:
      'Connect your Razorpay account to accept payments directly from WhatsApp messages.',
    icon: <KeyRound className="h-[18px] w-[18px]" aria-hidden="true" />,
    href: '/wachat/integrations/razorpay',
    status: 'ready',
  },
  {
    title: 'Shopify',
    description:
      'Sync orders, send abandoned-cart nudges and delivery updates from Shopify to WhatsApp.',
    icon: <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />,
    status: 'coming-soon',
  },
  {
    title: 'Zapier',
    description:
      'Connect 5,000+ apps to Wachat: trigger broadcasts, sync contacts, log events — no code.',
    icon: <Zap className="h-[18px] w-[18px]" aria-hidden="true" />,
    status: 'coming-soon',
  },
  {
    title: 'Google Sheets',
    description:
      'Sync contacts to/from a spreadsheet. Two-way updates, column mapping, scheduled pulls.',
    icon: <FileSpreadsheet className="h-[18px] w-[18px]" aria-hidden="true" />,
    status: 'coming-soon',
  },
  {
    title: 'WooCommerce',
    description: 'Trigger WhatsApp flows on order events: created, paid, shipped, delivered.',
    icon: <Store className="h-[18px] w-[18px]" aria-hidden="true" />,
    status: 'coming-soon',
  },
];

const oauthConnections = [
  {
    name: 'Facebook / Meta',
    description: 'Connect your WhatsApp Business Account (WABA)',
    icon: <Globe className="h-[18px] w-[18px]" aria-hidden="true" />,
    status: 'connected',
    connectedAt: 'Dec 1, 2023',
  },
  {
    name: 'Shopify',
    description: 'Sync your products and customers',
    icon: <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />,
    status: 'disconnected',
  },
  {
    name: 'Google Analytics',
    description: 'Track WhatsApp link clicks and widget interactions',
    icon: <PieChart className="h-[18px] w-[18px]" aria-hidden="true" />,
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
  const [tab, setTab] = useState('integrations');

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Integrations' },
      ]}
      title="Integrations"
      description="Plug SabNode into the rest of your stack. Link generators, embeddable widgets, and payment providers."
      width="wide"
    >
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'integrations', label: 'App Integrations' },
          { value: 'oauth', label: 'OAuth Connections' },
          { value: 'webhooks', label: 'Webhooks & API Keys' },
        ]}
      >
        <TabPanel value="integrations" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <Card key={integration.title} padding="none" className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="u-integration-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                    {integration.icon}
                  </span>
                  <CardTitle className="text-[15px]">{integration.title}</CardTitle>
                </div>

                <CardDescription className="mt-2 flex-1 text-sm leading-relaxed">
                  {integration.description}
                </CardDescription>

                <CardFooter className="mt-4 flex items-center justify-between">
                  {integration.status === 'ready' ? (
                    <Badge tone="success">Ready to configure</Badge>
                  ) : (
                    <Badge tone="neutral">Coming soon</Badge>
                  )}
                  {integration.status === 'ready' && integration.href ? (
                    <Link href={integration.href}>
                      <Button size="sm" variant="primary" iconRight={ArrowRight}>
                        Configure
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Notify me
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card padding="none" className="mt-6 flex items-center gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              <Puzzle className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <CardBody className="flex-1 p-0">
              <CardTitle className="text-[14px]">More integrations coming soon</CardTitle>
              <CardDescription className="text-[12.5px] leading-snug">
                Shopify, HubSpot, Zapier and Stripe are in the works. Need a specific one? Tell us.
              </CardDescription>
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel value="oauth" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {oauthConnections.map((app) => (
              <Card key={app.name} padding="none" className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                    {app.icon}
                  </span>
                  <div>
                    <CardTitle className="text-[15px] font-medium">{app.name}</CardTitle>
                    <CardDescription className="text-sm">{app.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {app.status === 'connected' ? (
                    <>
                      <div className="flex flex-col items-end">
                        <Badge tone="success">Connected</Badge>
                        <span className="mt-1 text-[11px] text-[var(--st-text-tertiary)]">
                          Since {app.connectedAt}
                        </span>
                      </div>
                      <Button size="sm" variant="outline">Disconnect</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="primary">Connect</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabPanel>

        <TabPanel value="webhooks" className="mt-4">
          <div className="space-y-8">
            <Card padding="none" className="p-5">
              <CardHeader>
                <div>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>
                    Manage webhook endpoints to receive real-time updates.
                  </CardDescription>
                </div>
                <Button size="sm" variant="primary" iconLeft={Plus}>
                  Add Webhook
                </Button>
              </CardHeader>
              <CardBody>
                <Table>
                  <THead>
                    <Tr>
                      <Th>URL</Th>
                      <Th>Events</Th>
                      <Th>Status</Th>
                      <Th>Created</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {webhooks.map((wh) => (
                      <Tr key={wh.id}>
                        <Td className="font-medium">{wh.url}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {wh.events.map((ev) => (
                              <Badge key={ev} tone="neutral" className="text-[10px] uppercase font-medium">{ev}</Badge>
                            ))}
                          </div>
                        </Td>
                        <Td>
                          {wh.status === 'active' ? (
                            <Badge tone="success">Active</Badge>
                          ) : (
                            <Badge tone="neutral">Inactive</Badge>
                          )}
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">{wh.createdAt}</Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-2">
                            <IconButton label="Edit webhook" icon={Edit2} variant="ghost" size="sm" />
                            <IconButton label="Delete webhook" icon={Trash2} variant="danger" size="sm" />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>

            <Card padding="none" className="p-5">
              <CardHeader>
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Manage API keys to authenticate your API requests.
                  </CardDescription>
                </div>
                <Button size="sm" variant="primary" iconLeft={Plus}>
                  Generate Key
                </Button>
              </CardHeader>
              <CardBody>
                <Table>
                  <THead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Key</Th>
                      <Th>Created At</Th>
                      <Th>Last Used</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {apiKeys.map((k) => (
                      <Tr key={k.id}>
                        <Td className="font-medium">{k.name}</Td>
                        <Td className="font-mono text-xs">{k.key}</Td>
                        <Td className="text-[var(--st-text-secondary)]">{k.createdAt}</Td>
                        <Td className="text-[var(--st-text-secondary)]">{k.lastUsed}</Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-2">
                            <IconButton label="Copy API key" icon={Copy} variant="ghost" size="sm" />
                            <IconButton label="Delete API key" icon={Trash2} variant="danger" size="sm" />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </WachatPage>
  );
}
