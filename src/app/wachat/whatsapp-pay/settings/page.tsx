'use client';

import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '@/components/sabcrm/20ui';
import { useToast } from '@/hooks/use-toast';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Loader2,
  CirclePlus,
  Settings,
  } from 'lucide-react';

import { getPaymentConfigurations } from '@/app/actions/whatsapp-pay.actions';
import { getProjectById } from '@/app/actions/index';
import { useProject } from '@/context/project-context';
import type { PaymentConfiguration,
  Project } from '@/lib/definitions';
import {
  CreatePaymentConfigDialog,
  DeletePaymentConfigButton,
  RegenerateOauthDialog,
  UpdateDataEndpointDialog,
  } from '@/app/wachat/_components/payment-config-dialogs';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat WhatsApp Pay — Setup tab (20ui).
 *
 * Setup instructions card + payment configuration list. Verify-merchant
 * dialog opens when the user requests OAuth regeneration. Existing
 * wabasimplify dialogs (Create / Update / Regenerate / Delete) handle
 * the actual flows — we keep them so server actions remain unchanged.
 */

import * as React from 'react';

/* ── helpers ──────────────────────────────────────────────────── */

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between py-2.5 text-[13px] last:border-b-0"
      style={{ borderBottom: '1px solid var(--st-border)' }}
    >
      <span style={{ color: 'var(--st-text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--st-text)' }}>{value}</span>
    </div>
  );
}

function statusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!status) return 'danger';
  const s = status.toLowerCase();
  if (s === 'active') return 'success';
  if (s.includes('needs')) return 'warning';
  return 'danger';
}

/* ── page ──────────────────────────────────────────────────────── */

export default function WhatsAppPaySetupPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [configs, setConfigs] = useState<PaymentConfiguration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const activeProjectId = activeProject?._id?.toString() ?? null;

  const fetchData = useCallback(
    (showToast = false) => {
      if (!activeProjectId) {
        setError('No active project selected.');
        return;
      }
      startLoading(async () => {
        const projectData = await getProjectById(activeProjectId);
        setProject(projectData);
        if (projectData) {
          const { configurations, error: fetchError } =
            await getPaymentConfigurations(activeProjectId);
          if (fetchError) setError(fetchError);
          else {
            setError(null);
            setConfigs(configurations);
          }
        }
        if (showToast) {
          toast({
            title: 'Refreshed',
            description: 'Payment configurations have been updated from Meta.',
          });
        }
      });
    },
    [activeProjectId, toast],
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const commerceManagerUrl = project?.appId
    ? `https://business.facebook.com/commerce/?app_id=${project.appId}`
    : 'https://business.facebook.com/commerce/';

  const breadcrumb = [
    { label: 'SabNode', href: '/dashboard' },
    { label: 'WaChat', href: '/wachat' },
    { label: 'WhatsApp Pay', href: '/wachat/whatsapp-pay' },
    { label: 'Settings' },
  ];

  if (!project && !isLoading) {
    return (
      <WachatPage
        breadcrumb={breadcrumb}
        title="WhatsApp Pay settings"
        description="Manage payment providers linked to your WABA."
        width="narrow"
      >
        <Alert tone="danger" title="No project selected">
          No project selected. Please select a project to manage its payment
          settings.
        </Alert>
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={breadcrumb}
      title="WhatsApp Pay settings"
      description="Manage payment providers linked to your WABA."
      width="narrow"
    >
      <div className="flex w-full flex-col gap-6">
        {isCreateOpen && (
          <CreatePaymentConfigDialog
            isOpen={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            onSuccess={fetchData}
          />
        )}

        {/* Setup instructions */}
        <Card padding="none" className="p-5">
          <h3 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
            WhatsApp Pay Setup
          </h3>
          <p
            className="mt-1 text-[13px]"
            style={{ color: 'var(--st-text-secondary)' }}
          >
            To enable WhatsApp Pay, configure a payment provider (like Razorpay
            or PayU) within your Meta Commerce Manager.
          </p>
          <ol
            className="mt-4 list-inside list-decimal space-y-1.5 text-[13px]"
            style={{ color: 'var(--st-text-secondary)' }}
          >
            <li>Navigate to your Meta Commerce Manager.</li>
            <li>
              Go to the{' '}
              <span style={{ color: 'var(--st-text)' }}>Settings</span> tab.
            </li>
            <li>
              Select{' '}
              <span style={{ color: 'var(--st-text)' }}>Payment Method</span> and
              add your preferred provider.
            </li>
            <li>
              Once configured, click &quot;Refresh&quot; below to see your setup.
            </li>
          </ol>
          <div className="mt-5">
            <a
              href={commerceManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" iconRight={ExternalLink}>
                Go to Commerce Manager
              </Button>
            </a>
          </div>
        </Card>

        {/* Configurations list */}
        <Card padding="none" className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
                Your Payment Configurations
              </h3>
              <p
                className="mt-0.5 text-[12px]"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                Payment providers linked to your WABA.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={isLoading}
                iconLeft={isLoading ? Loader2 : RefreshCw}
              >
                Refresh
              </Button>
              <Button size="sm" variant="primary" onClick={() => setIsCreateOpen(true)} iconLeft={CirclePlus}>
                Create
              </Button>
            </div>
          </div>

          <div className="mt-5">
            {error ? (
              <Alert tone="danger">{error}</Alert>
            ) : isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <Card key={i} variant="outlined" padding="none" className="p-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Skeleton circle width={16} height={16} />
                      <Skeleton height={16} width={128} />
                    </div>
                    <div className="flex flex-col gap-2 mt-3">
                      <Skeleton height={36} width="100%" />
                      <Skeleton height={36} width="100%" />
                      <Skeleton height={36} width="100%" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : configs.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {configs.map((config) => (
                  <Card
                    key={config.configuration_name}
                    variant="outlined"
                    padding="none"
                    className="p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Settings
                        className="h-4 w-4"
                        style={{ color: 'var(--st-text-secondary)' }}
                        aria-hidden="true"
                      />
                      <h4 className="text-[14px]" style={{ color: 'var(--st-text)' }}>
                        {config.configuration_name}
                      </h4>
                    </div>
                    <div className="mt-3">
                      <InfoRow
                        label="Provider"
                        value={
                          <span className="capitalize">
                            {config.provider_name}
                          </span>
                        }
                      />
                      <InfoRow
                        label="Status"
                        value={
                          <Badge tone={statusTone(config.status)}>
                            {config.status}
                          </Badge>
                        }
                      />
                      <InfoRow
                        label="Provider MID"
                        value={
                          <span className="font-mono text-[11px]">
                            {config.provider_mid}
                          </span>
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <UpdateDataEndpointDialog
                        project={project!}
                        config={config}
                        onSuccess={fetchData}
                      />
                      {config.status === 'Needs_Connecting' && (
                        <RegenerateOauthDialog
                          project={project!}
                          config={config}
                          onSuccess={fetchData}
                        />
                      )}
                      <DeletePaymentConfigButton
                        projectId={project!._id.toString()}
                        configName={config.configuration_name}
                        onSuccess={fetchData}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Settings}
                title="No payment configurations"
                description="No payment providers are linked to this WABA yet. Create one to get started."
                action={
                  <Button size="sm" variant="primary" onClick={() => setIsCreateOpen(true)} iconLeft={CirclePlus}>
                    Create configuration
                  </Button>
                }
              />
            )}
          </div>
        </Card>
      </div>
    </WachatPage>
  );
}
