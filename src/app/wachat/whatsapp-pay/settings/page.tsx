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
  CheckCircle2,
  Clock,
  Send,
  Building,
  Wallet,
  Shield,
} from 'lucide-react';
import { Alert, ZoruAlertDescription, Input, Label, useZoruToast } from '@/components/zoruui';

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
  MetricTile,
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
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [testAmount, setTestAmount] = useState('100');
  const [testing, setTesting] = useState(false);

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
          else { setError(null); setConfigs(configurations); setLastSync(new Date()); }
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

  const activeConfigs = configs.filter((c) => c.status === 'Active').length;
  const needsConnecting = configs.filter((c) => c.status === 'Needs_Connecting').length;
  const providers = new Set(configs.map((c) => c.provider_name?.toLowerCase()).filter(Boolean));

  const handleTestPayment = async () => {
    if (!testAmount || activeConfigs === 0) return;
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setTesting(false);
    toast({ title: 'Test payment initiated', description: `Sandbox charge of ₹${testAmount} routed.` });
  };

  return (
    <div className="flex flex-col gap-4">
      {isCreateOpen && (
        <CreatePaymentConfigDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchData} />
      )}

      {/* Provider connection KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Active providers" value={activeConfigs.toLocaleString('en-IN')} icon={CheckCircle2} delay={0.02} />
        <MetricTile label="Needs setup" value={needsConnecting.toLocaleString('en-IN')} icon={AlertCircle} delay={0.04} />
        <MetricTile label="Unique providers" value={providers.size.toString()} icon={Wallet} delay={0.06} />
        <MetricTile
          label="Last sync"
          value={lastSync ? `${Math.max(1, Math.floor((Date.now() - lastSync.getTime()) / 60_000))}m ago` : '-'}
          icon={Clock}
          delay={0.08}
        />
      </section>

      {/* Setup steps */}
      <Section
        title="Setup checklist"
        description="Configure a payment provider inside Meta Commerce Manager, then sync here."
        action={
          <a href={commerceManagerUrl} target="_blank" rel="noopener noreferrer">
            <WaButton size="sm" rightIcon={ExternalLink}>Commerce Manager</WaButton>
          </a>
        }
      >
        <ol className="grid grid-cols-1 gap-2 text-[12.5px] text-zinc-700 sm:grid-cols-2 lg:grid-cols-4">
          <Step n={1} icon={Building} text="Open Meta Commerce Manager and pick the right Business account." done={!!project?.appId} />
          <Step n={2} icon={Settings} text="Settings → Payment Method → Add a provider." done={configs.length > 0} />
          <Step n={3} icon={Shield} text="Add Razorpay, PayU, or Stripe and authorize the WABA." done={activeConfigs > 0} />
          <Step n={4} icon={RefreshCw} text="Return here and Refresh to sync configurations." done={!!lastSync} />
        </ol>
      </Section>

      {/* Configurations */}
      <Section
        title="Payment configurations"
        description={`${configs.length} provider${configs.length === 1 ? '' : 's'} linked · ${activeConfigs} active`}
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
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-[180px] animate-pulse rounded-xl border border-zinc-200 bg-white p-4" />
            ))}
          </div>
        ) : configs.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {configs.map((config, i) => (
              <m.div
                key={config.configuration_name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.05, ease: EASE_OUT }}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-lg text-white"
                      style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
                    >
                      <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-[13.5px] font-semibold text-zinc-900">{config.configuration_name}</h4>
                      <p className="truncate text-[11px] capitalize text-zinc-500">{config.provider_name}</p>
                    </div>
                  </div>
                  <StatusPill tone={statusTone(config.status)}>{config.status}</StatusPill>
                </div>
                <dl className="mt-3 divide-y divide-zinc-100 text-[12px]">
                  <InfoRow label="Provider MID" value={<span className="font-mono text-[10.5px]">{config.provider_mid}</span>} />
                  <InfoRow label="Last tested" value={<span className="text-zinc-500">{lastSync ? `${Math.max(1, Math.floor((Date.now() - lastSync.getTime()) / 60_000))}m ago` : 'pending'}</span>} />
                </dl>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
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

      {/* Test payment */}
      <Section title="Test payment" description="Send a sandbox charge through your active provider.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-full max-w-xs flex-col gap-1.5">
            <Label htmlFor="test-amount">Amount (INR)</Label>
            <Input
              id="test-amount"
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              min="1"
              placeholder="100"
            />
          </div>
          <WaButton
            onClick={handleTestPayment}
            disabled={testing || activeConfigs === 0 || !testAmount}
            leftIcon={testing ? Loader2 : Send}
          >
            {testing ? 'Routing...' : 'Send test charge'}
          </WaButton>
          {activeConfigs === 0 && (
            <p className="text-[11.5px] text-zinc-500">Activate at least one provider to test.</p>
          )}
        </div>
      </Section>
    </div>
  );
}

function Step({ n, text, icon: Icon, done }: { n: number; text: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; done?: boolean }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
        style={done
          ? { background: 'var(--mt-accent)' }
          : { backgroundImage: 'linear-gradient(135deg, #71717a, #a1a1aa)' }}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Icon className="h-3 w-3" strokeWidth={2.25} /> Step {n}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-zinc-700">{text}</p>
      </div>
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-900">{value}</dd>
    </div>
  );
}
