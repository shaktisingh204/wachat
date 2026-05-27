'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { m, useReducedMotion } from 'motion/react';
import {
  ExternalLink,
  RefreshCw,
  Loader2,
  CirclePlus,
  Settings,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { Alert, ZoruAlertDescription, useZoruToast } from '@/components/zoruui';

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
  Section,
  WaButton,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const statusTone = (s: string): StatusTone => {
  const v = (s || '').toLowerCase();
  if (v === 'active') return 'live';
  if (v.includes('needs')) return 'queued';
  return 'failed';
};

export default function WhatsAppPaySetupPage() {
  const reduce = useReducedMotion();
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
          const { configurations, error: fetchError } = await getPaymentConfigurations(activeProjectId);
          if (fetchError) setError(fetchError);
          else { setError(null); setConfigs(configurations); }
        }
        if (showToast) toast({ title: 'Refreshed', description: 'Payment configurations updated from Meta.' });
      });
    },
    [activeProjectId, toast],
  );

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeProjectId]);

  const commerceManagerUrl = project?.appId
    ? `https://business.facebook.com/commerce/?app_id=${project.appId}`
    : 'https://business.facebook.com/commerce/';

  if (!project && !isLoading) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertDescription>No project selected. Please select one to manage its payment settings.</ZoruAlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isCreateOpen && (
        <CreatePaymentConfigDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchData} />
      )}

      <Section title="Setup steps" description="Configure a payment provider inside Meta Commerce Manager, then sync here.">
        <ol className="grid grid-cols-1 gap-3 text-[13px] text-zinc-700 sm:grid-cols-2">
          <Step n={1} text="Open Meta Commerce Manager." />
          <Step n={2} text="Go to Settings, then Payment Method." />
          <Step n={3} text="Add a provider like Razorpay or PayU." />
          <Step n={4} text="Come back here and click Refresh." />
        </ol>
        <div className="mt-5">
          <a href={commerceManagerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
            <WaButton rightIcon={ExternalLink}>Go to Commerce Manager</WaButton>
          </a>
        </div>
      </Section>

      <Section
        title="Payment configurations"
        description="Providers linked to your WABA."
        action={
          <div className="flex items-center gap-2">
            <WaButton variant="outline" size="sm" onClick={() => fetchData(true)} disabled={isLoading} leftIcon={isLoading ? Loader2 : RefreshCw}>
              Refresh
            </WaButton>
            <WaButton size="sm" leftIcon={CirclePlus} onClick={() => setIsCreateOpen(true)}>Create</WaButton>
          </div>
        }
      >
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-[160px] animate-pulse rounded-2xl border border-zinc-200 bg-white p-4" />
            ))}
          </div>
        ) : configs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {configs.map((config, i) => (
              <m.div
                key={config.configuration_name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : i * 0.05, ease: EASE_OUT }}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-xl text-white"
                    style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
                  >
                    <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>
                  <h4 className="text-[14px] font-semibold text-zinc-900">{config.configuration_name}</h4>
                </div>
                <dl className="mt-3 divide-y divide-zinc-100 text-[12.5px]">
                  <InfoRow label="Provider" value={<span className="capitalize">{config.provider_name}</span>} />
                  <InfoRow label="Status" value={<StatusPill tone={statusTone(config.status)}>{config.status}</StatusPill>} />
                  <InfoRow label="Provider MID" value={<span className="font-mono text-[11px]">{config.provider_mid}</span>} />
                </dl>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <UpdateDataEndpointDialog project={project!} config={config} onSuccess={fetchData} />
                  {config.status === 'Needs_Connecting' && (
                    <RegenerateOauthDialog project={project!} config={config} onSuccess={fetchData} />
                  )}
                  <DeletePaymentConfigButton projectId={project!._id.toString()} configName={config.configuration_name} onSuccess={fetchData} />
                </div>
              </m.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Settings}
            title="No payment configurations"
            description="No payment providers are linked to this WABA yet. Create one to get started."
            action={<WaButton size="sm" leftIcon={CirclePlus} onClick={() => setIsCreateOpen(true)}>Create configuration</WaButton>}
          />
        )}
      </Section>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-3">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
      >
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  );
}
