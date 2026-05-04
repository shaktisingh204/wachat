'use client';

/**
 * Wachat WhatsApp Pay — Setup tab (ZoruUI).
 *
 * Setup instructions card + payment configuration list. Verify-merchant
 * dialog opens when the user requests OAuth regeneration. Existing
 * wabasimplify dialogs (Create / Update / Regenerate / Delete) handle
 * the actual flows — we keep them so server actions remain unchanged.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Loader2,
  CirclePlus,
  Settings,
  AlertCircle,
} from 'lucide-react';

import { getPaymentConfigurations } from '@/app/actions/whatsapp-pay.actions';
import { getProjectById } from '@/app/actions/index';
import { useProject } from '@/context/project-context';
import type { PaymentConfiguration, Project } from '@/lib/definitions';
import {
  CreatePaymentConfigDialog,
  DeletePaymentConfigButton,
  RegenerateOauthDialog,
  UpdateDataEndpointDialog,
} from '@/app/wachat/_components/payment-config-dialogs';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

/* ── helpers ──────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <ZoruSkeleton className="h-64 w-full" />
      <ZoruSkeleton className="h-48 w-full" />
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zoru-line py-2.5 text-[13px] last:border-b-0">
      <span className="text-zoru-ink-muted">{label}</span>
      <span className="text-zoru-ink">{value}</span>
    </div>
  );
}

function statusVariant(
  status: string,
): 'success' | 'warning' | 'danger' | 'ghost' {
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
  const { toast } = useZoruToast();
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

  const commerceManagerUrl = 'https://business.facebook.com/commerce/';

  if (isLoading && !project) return <PageSkeleton />;

  if (!project) {
    return (
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertDescription>
          No project selected. Please select a project to manage its payment
          settings.
        </ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6">
      {isCreateOpen && (
        <CreatePaymentConfigDialog
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={fetchData}
        />
      )}

      {/* Setup instructions */}
      <ZoruCard className="p-5">
        <h3 className="text-[15px] text-zoru-ink">WhatsApp Pay Setup</h3>
        <p className="mt-1 text-[13px] text-zoru-ink-muted">
          To enable WhatsApp Pay, configure a payment provider (like Razorpay
          or PayU) within your Meta Commerce Manager.
        </p>
        <ol className="mt-4 list-inside list-decimal space-y-1.5 text-[13px] text-zoru-ink-muted">
          <li>Navigate to your Meta Commerce Manager.</li>
          <li>
            Go to the <span className="text-zoru-ink">Settings</span> tab.
          </li>
          <li>
            Select <span className="text-zoru-ink">Payment Method</span> and add
            your preferred provider.
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
            <ZoruButton size="sm">
              Go to Commerce Manager
              <ExternalLink />
            </ZoruButton>
          </a>
        </div>
      </ZoruCard>

      {/* Configurations list */}
      <ZoruCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] text-zoru-ink">
              Your Payment Configurations
            </h3>
            <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
              Payment providers linked to your WABA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh
            </ZoruButton>
            <ZoruButton size="sm" onClick={() => setIsCreateOpen(true)}>
              <CirclePlus />
              Create
            </ZoruButton>
          </div>
        </div>

        <div className="mt-5">
          {error ? (
            <ZoruAlert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : configs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {configs.map((config) => (
                <ZoruCard
                  key={config.configuration_name}
                  variant="soft"
                  className="p-4"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-zoru-ink-muted" />
                    <h4 className="text-[14px] text-zoru-ink">
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
                        <ZoruBadge variant={statusVariant(config.status)}>
                          {config.status}
                        </ZoruBadge>
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
                      project={project}
                      config={config}
                      onSuccess={fetchData}
                    />
                    {config.status === 'Needs_Connecting' && (
                      <RegenerateOauthDialog
                        project={project}
                        config={config}
                        onSuccess={fetchData}
                      />
                    )}
                    <DeletePaymentConfigButton
                      projectId={project._id.toString()}
                      configName={config.configuration_name}
                      onSuccess={fetchData}
                    />
                  </div>
                </ZoruCard>
              ))}
            </div>
          ) : (
            <ZoruEmptyState
              icon={<Settings />}
              title="No payment configurations"
              description="No payment providers are linked to this WABA yet. Create one to get started."
              action={
                <ZoruButton size="sm" onClick={() => setIsCreateOpen(true)}>
                  <CirclePlus />
                  Create configuration
                </ZoruButton>
              }
            />
          )}
        </div>
      </ZoruCard>
    </div>
  );
}
