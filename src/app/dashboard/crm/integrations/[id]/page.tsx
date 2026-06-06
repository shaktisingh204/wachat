import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil,
  ShieldAlert } from 'lucide-react';

/**
 * Integration detail page.
 *
 * Server component — loads a single `crm_integrations` doc (credentials
 * are already redacted to `'***hidden***'` by the action) and renders it
 * inside `<EntityDetailShell />` with Connect/Disconnect, Edit, and
 * Delete in the action group. Audit timeline footer is wired against the
 * `'integration'` entityKind used by the write actions.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getSession } from '@/app/actions/user.actions';
import { getIntegrationById } from '@/app/actions/crm-integrations.actions';

import {
  IntegrationConnectButton,
  IntegrationDeleteButton,
  IntegrationSyncButton,
} from './_components/integration-detail-actions';
import { SyncStatusMonitor } from '../_components/sync-status-monitor';
import { WebhookLogsPreview } from '../_components/webhook-logs';
import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/integrations';

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC', // Ensure deterministic dates for hydration
  }).format(d);
}

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const integration = await getIntegrationById(id);
  if (!integration) notFound();

  const connected = integration.status === 'connected' && integration.isActive;
  const configKeys = Object.keys(integration.config ?? {});

  return (
    <EntityDetailShell
      title={integration.name}
      eyebrow={`INTEGRATION · ${integration.provider.toUpperCase()}`}
        status={{
          label: connected
            ? 'Connected'
            : integration.status === 'error'
              ? 'Error'
              : 'Disconnected',
          tone:
            connected
              ? 'green'
              : integration.status === 'error'
                ? 'red'
                : 'neutral',
        }}
        back={{ href: BASE, label: 'Back to integrations' }}
        actions={
          <>
            <IntegrationConnectButton
              integrationId={String(integration._id)}
              isActive={integration.isActive}
            />
            {connected && (
              <IntegrationSyncButton integrationId={String(integration._id)} />
            )}
            <Button variant="outline" asChild>
              <Link href={`${BASE}/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <IntegrationDeleteButton
              integrationId={String(integration._id)}
              name={integration.name}
            />
          </>
        }
        audit={
          <EntityAuditTimeline
            entityKind="integration"
            entityId={String(integration._id)}
          />
        }
      >
        {/* Summary */}
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-medium text-zoru-ink">
              Overview
            </div>
            <Badge variant="outline" className="capitalize">
              {integration.provider}
            </Badge>
            {integration.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="ghost">Inactive</Badge>
            )}
            <SyncStatusMonitor 
              integrationId={String(integration._id)} 
              initialStatus={integration.syncStatus} 
            />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
            <div>
              <div className="text-zoru-ink-muted">Provider</div>
              <div className="text-zoru-ink capitalize">
                {integration.provider}
              </div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Status</div>
              <div className="text-zoru-ink capitalize">
                {integration.status}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-zoru-ink-muted">Webhook URL</div>
              <div className="break-all font-mono text-zoru-ink">
                {integration.webhookUrl || '—'}
              </div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Last sync</div>
              <div suppressHydrationWarning className="text-zoru-ink">
                {fmtDate(integration.lastSyncAt)}
              </div>
            </div>
            <div>
              <div className="text-zoru-ink-muted">Last updated</div>
              <div suppressHydrationWarning className="text-zoru-ink">
                {fmtDate(integration.updatedAt)}
              </div>
            </div>
          </div>
        </Card>

        {/* Config */}
        <Card className="p-6">
          <div className="mb-3 text-[14px] font-medium text-zoru-ink">
            Config
          </div>
          {configKeys.length === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No non-secret configuration set.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 font-mono text-[12.5px] text-zoru-ink">
              {JSON.stringify(integration.config, null, 2)}
            </pre>
          )}
        </Card>

        {/* Credentials — never plaintext */}
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-1.5 text-[14px] font-medium text-zoru-ink">
            <ShieldAlert className="h-4 w-4 text-zoru-ink" />
            Credentials
          </div>
          <p className="text-[13px] text-zoru-ink-muted">
            Encrypted at rest. Never displayed back to the UI — even to the
            owner. To rotate secrets, open Edit and paste a fresh JSON
            payload into the credentials field.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-1.5 font-mono text-[12.5px] text-zoru-ink">
            ***hidden***
          </div>
        </Card>

        {/* Webhook Logs */}
        {integration.provider === 'webhook' && (
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <WebhookLogsPreview integrationId={String(integration._id)} />
          </Suspense>
        )}
    </EntityDetailShell>
  );
}
