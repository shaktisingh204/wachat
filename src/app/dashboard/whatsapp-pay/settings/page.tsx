'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  LuExternalLink,
  LuRefreshCw,
  LuLoader,
  LuCirclePlus,
  LuSettings,
  LuCircleAlert,
} from 'react-icons/lu';

import { getPaymentConfigurations } from '@/app/actions/whatsapp-pay.actions';
import { getProjectById } from '@/app/actions/index';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { PaymentConfiguration, Project } from '@/lib/definitions';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CreatePaymentConfigDialog } from '@/components/wabasimplify/create-payment-config-dialog';
import { RegenerateOauthDialog } from '@/components/wabasimplify/regenerate-oauth-dialog';
import { UpdateDataEndpointDialog } from '@/components/wabasimplify/update-data-endpoint-dialog';
import { DeletePaymentConfigButton } from '@/components/wabasimplify/delete-payment-config-button';

/* ── helpers ──────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-64 w-full animate-pulse rounded-clay-lg bg-clay-bg-2" />
      <div className="h-48 w-full animate-pulse rounded-clay-lg bg-clay-bg-2" />
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
    <div className="flex items-center justify-between border-b border-clay-border py-2.5 text-[13px]">
      <span className="text-clay-ink-muted">{label}</span>
      <span className="font-medium text-clay-ink">{value}</span>
    </div>
  );
}

function statusTone(status: string): 'green' | 'amber' | 'red' {
  if (!status) return 'red';
  const s = status.toLowerCase();
  if (s === 'active') return 'green';
  if (s.includes('needs')) return 'amber';
  return 'red';
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
          else setConfigs(configurations);
        }
        if (showToast) {
          toast({
            title: 'Refreshed',
            description:
              'Payment configurations have been updated from Meta.',
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
      <div className="flex items-center gap-3 rounded-clay-md border border-clay-red/20 bg-red-50 p-4 text-[13px] text-clay-red">
        <LuCircleAlert className="h-4 w-4 shrink-0" />
        No project selected. Please select a project to manage its payment
        settings.
      </div>
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
      <ClayCard className="p-5">
        <h3 className="text-[15px] font-semibold text-clay-ink">
          WhatsApp Pay Setup
        </h3>
        <p className="mt-1 text-[13px] text-clay-ink-muted">
          To enable WhatsApp Pay, configure a payment provider (like Razorpay or
          PayU) within your Meta Commerce Manager.
        </p>
        <ol className="mt-4 list-inside list-decimal space-y-1.5 text-[13px] text-clay-ink-muted">
          <li>Navigate to your Meta Commerce Manager.</li>
          <li>
            Go to the <strong className="text-clay-ink">Settings</strong> tab.
          </li>
          <li>
            Select <strong className="text-clay-ink">Payment Method</strong> and
            add your preferred provider.
          </li>
          <li>
            Once configured, click &quot;Refresh&quot; below to see your setup.
          </li>
        </ol>
        <div className="mt-5">
          <a href={commerceManagerUrl} target="_blank" rel="noopener noreferrer">
            <ClayButton
              variant="obsidian"
              size="sm"
              trailing={
                <LuExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              }
            >
              Go to Commerce Manager
            </ClayButton>
          </a>
        </div>
      </ClayCard>

      {/* Configurations list */}
      <ClayCard className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-clay-ink">
              Your Payment Configurations
            </h3>
            <p className="mt-0.5 text-[12px] text-clay-ink-muted">
              Payment providers linked to your WABA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ClayButton
              variant="pill"
              size="sm"
              leading={
                isLoading ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                )
              }
              onClick={() => fetchData(true)}
            >
              Refresh
            </ClayButton>
            <ClayButton
              variant="obsidian"
              size="sm"
              leading={
                <LuCirclePlus className="h-3.5 w-3.5" strokeWidth={2} />
              }
              onClick={() => setIsCreateOpen(true)}
            >
              Create
            </ClayButton>
          </div>
        </div>

        <div className="mt-5">
          {error ? (
            <div className="flex items-center gap-3 rounded-clay-md border border-clay-red/20 bg-red-50 p-4 text-[13px] text-clay-red">
              <LuCircleAlert className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : configs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {configs.map((config) => (
                <ClayCard
                  key={config.configuration_name}
                  variant="soft"
                  className="p-4"
                >
                  <div className="flex items-center gap-2">
                    <LuSettings className="h-4 w-4 text-clay-ink-muted" />
                    <h4 className="text-[14px] font-semibold text-clay-ink">
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
                        <ClayBadge tone={statusTone(config.status)}>
                          {config.status}
                        </ClayBadge>
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
                </ClayCard>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[13px] text-clay-ink-muted">
              No payment configurations found for this WABA.
            </p>
          )}
        </div>
      </ClayCard>
    </div>
  );
}
