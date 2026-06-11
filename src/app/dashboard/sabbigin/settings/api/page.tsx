import Link from 'next/link';
import { ArrowLeft, Bot, Code2, Terminal } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { ApiKeyManager } from '@/components/sabcrm/apikey-manager';
import { WebhookManager } from '@/components/sabcrm/webhook-manager';
import { listApiKeysAction } from '@/app/actions/sabcrm.actions';
import type { SabcrmApiKey } from '@/lib/sabcrm/apikeys.server';

export const dynamic = 'force-dynamic';

const REST_ENDPOINTS: { method: string; path: string; description: string }[] = [
  { method: 'GET', path: '/api/v1/crm/contacts', description: 'List & filter contacts' },
  { method: 'POST', path: '/api/v1/crm/contacts', description: 'Create a contact' },
  { method: 'GET', path: '/api/v1/crm/deals', description: 'List & filter deals' },
  { method: 'POST', path: '/api/v1/crm/deals', description: 'Create a deal' },
  { method: 'GET', path: '/api/v1/crm/accounts', description: 'List companies' },
];

export default async function SabbiginApiSettingsPage() {
  const keysResult = await listApiKeysAction();
  const initialKeys: SabcrmApiKey[] = keysResult.ok ? keysResult.data : [];

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings"
              className="inline-flex items-center gap-1 hover:text-[var(--st-text)]"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Settings
            </Link>
          </PageEyebrow>
          <PageTitle>API &amp; webhooks</PageTitle>
          <PageDescription>
            Issue API keys, register webhooks, and connect SabBigin to your own
            tools over the REST API and MCP.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* API keys */}
      <Card padding="none">
        <CardBody>
          <ApiKeyManager initialKeys={initialKeys} />
        </CardBody>
      </Card>

      {/* Webhooks (self-fetching client component) */}
      <WebhookManager />

      {/* REST reference */}
      <Card padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
            REST API
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 pt-0">
          <p className="text-xs text-[var(--st-text-secondary)]">
            Authenticate every request with an API key from above as a bearer
            token:{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1.5 py-0.5 text-[var(--st-text)]">
              Authorization: Bearer sk_crm_…
            </code>
            . The base path for all CRM resources is{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1.5 py-0.5 text-[var(--st-text)]">
              /api/v1/crm/*
            </code>
            .
          </p>
          <ul className="flex flex-col divide-y divide-[var(--st-border)] overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
            {REST_ENDPOINTS.map((ep) => (
              <li
                key={`${ep.method} ${ep.path}`}
                className="flex items-center gap-3 bg-[var(--st-bg)] px-3 py-2"
              >
                <Badge
                  tone={ep.method === 'GET' ? 'info' : 'success'}
                  kind="soft"
                  className="w-14 justify-center font-mono"
                >
                  {ep.method}
                </Badge>
                <code className="font-mono text-xs text-[var(--st-text)]">
                  {ep.path}
                </code>
                <span className="ml-auto text-xs text-[var(--st-text-secondary)]">
                  {ep.description}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* MCP */}
      <Card padding="none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
            MCP server
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 pt-0">
          <p className="text-xs text-[var(--st-text-secondary)]">
            SabBigin exposes a Model Context Protocol endpoint so AI assistants
            can read and act on your CRM data with the same key-based auth and
            scopes as the REST API.
          </p>
          <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
            <Terminal className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            <code className="font-mono text-xs text-[var(--st-text)]">
              POST /api/mcp/sabbigin
            </code>
          </div>
          <p className="text-xs text-[var(--st-text-tertiary)]">
            Point your MCP-capable client at this endpoint and authenticate with
            an API key issued above.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
