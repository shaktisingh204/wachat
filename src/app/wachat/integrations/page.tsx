'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  EmptyState,
  IconButton,
  Tabs,
  TabPanel,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  WaterLoader,
  useToast,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  connectOauthProvider,
  disconnectOauthProvider,
  listOauthConnections,
} from '@/app/actions/wachat-integrations-hub.actions';
import type { OauthConnection } from '@/lib/rust-client/wachat-integrations-hub';
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
  Plug,
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

/**
 * Presentation metadata for each OAuth provider slug. The connection *state*
 * (connected / accountLabel / connectedAt) is live data from the Rust crate
 * `wachat-integrations-hub`; this map only supplies the human label, blurb,
 * and icon keyed by the provider slug the backend returns.
 */
const OAUTH_PROVIDER_META: Record<
  string,
  { name: string; description: string; icon: React.ReactNode }
> = {
  facebook: {
    name: 'Facebook / Meta',
    description: 'Connect your WhatsApp Business Account (WABA)',
    icon: <Globe className="h-[18px] w-[18px]" aria-hidden="true" />,
  },
  shopify: {
    name: 'Shopify',
    description: 'Sync your products and customers',
    icon: <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />,
  },
  'google-analytics': {
    name: 'Google Analytics',
    description: 'Track WhatsApp link clicks and widget interactions',
    icon: <PieChart className="h-[18px] w-[18px]" aria-hidden="true" />,
  },
};

function formatConnectedAt(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * OAuth Connections tab — real data via the `wachat-integrations-hub` crate.
 *
 * Loads on mount, renders loading / error / empty / populated states, and
 * wires Connect + Disconnect to the server actions with optimistic per-row
 * pending state and toast feedback.
 */
function OauthConnectionsTab(): React.JSX.Element {
  const { toast } = useToast();
  const [connections, setConnections] = useState<OauthConnection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Provider slug currently being mutated (connect/disconnect in flight). */
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await listOauthConnections();
    if (res.error) {
      setLoadError(res.error);
      setConnections(null);
    } else {
      setConnections(res.connections ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = useCallback(
    async (provider: string, name: string) => {
      setPending(provider);
      const res = await connectOauthProvider(provider);
      setPending(null);
      if (res.success) {
        toast({ tone: 'success', title: `${name} connection started.` });
        void load();
      } else {
        toast({
          tone: 'danger',
          title: `Could not connect ${name}.`,
          description: res.error,
        });
      }
    },
    [toast, load],
  );

  const handleDisconnect = useCallback(
    async (provider: string, name: string) => {
      setPending(provider);
      const res = await disconnectOauthProvider(provider);
      setPending(null);
      if (res.success) {
        toast({ tone: 'success', title: `${name} disconnected.` });
        void load();
      } else {
        toast({
          tone: 'danger',
          title: `Could not disconnect ${name}.`,
          description: res.error,
        });
      }
    },
    [toast, load],
  );

  if (loading && connections === null) {
    return (
      <div className="flex justify-center py-16" role="status" aria-busy="true">
        <WaterLoader width={220} caption="Loading connections" label="Loading OAuth connections" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert tone="danger" className="mt-1">
        <AlertTitle>Couldn&apos;t load connections</AlertTitle>
        <AlertDescription>
          {loadError}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <EmptyState
        icon={Plug}
        title="No connections yet"
        description="Connect Facebook, Shopify or Google Analytics to power WABA messaging, product sync, and click tracking."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {connections.map((conn) => {
        const meta = OAUTH_PROVIDER_META[conn.provider] ?? {
          name: conn.provider,
          description: 'OAuth connection',
          icon: <Plug className="h-[18px] w-[18px]" aria-hidden="true" />,
        };
        const since = formatConnectedAt(conn.connectedAt);
        const isPending = pending === conn.provider;

        return (
          <Card
            key={conn.provider}
            padding="none"
            className="flex items-center justify-between gap-4 p-5"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
                {meta.icon}
              </span>
              <div>
                <CardTitle className="text-[15px] font-medium">{meta.name}</CardTitle>
                <CardDescription className="text-sm">
                  {conn.accountLabel ?? meta.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {conn.connected ? (
                <>
                  <div className="flex flex-col items-end">
                    <Badge tone="success">Connected</Badge>
                    {since ? (
                      <span className="mt-1 text-[11px] text-[var(--st-text-tertiary)]">
                        Since {since}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => void handleDisconnect(conn.provider, meta.name)}
                  >
                    {isPending ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={isPending}
                  onClick={() => void handleConnect(conn.provider, meta.name)}
                >
                  {isPending ? 'Connecting…' : 'Connect'}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

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
          <OauthConnectionsTab />
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
