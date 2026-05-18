'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Facebook,
  PowerOff,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeadGenConfig,
  saveLeadGenConfigAction as saveLeadGenConfig,
  deleteLeadGenFormAction as deleteLeadGenForm,
  getLeadGenActivity,
  autoSetupFacebookLeadGen,
  disconnectFacebookLeadGen,
  type FbPageSummary,
} from './actions';
import type {
  LeadGenConfig,
  ActivityEntry,
  FormConfig,
  CampaignRule,
} from '@/lib/rust-client/wachat-facebook-leadgen-config';

type Tab = 'overview' | 'activity' | 'advanced';

const META_OAUTH_HREF = '/api/auth/meta-suite/login?state=facebook';

export default function FacebookAdsIntegrationPage() {
  const { toast } = useZoruToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState<LeadGenConfig | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [pageOptions, setPageOptions] = useState<FbPageSummary[] | null>(null);
  const [needsMetaConnect, setNeedsMetaConnect] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());

  const [loading, startLoading] = useTransition();
  const [setting, startSetup] = useTransition();
  const [loadingActivity, startLoadingActivity] = useTransition();
  const [saving, startSaving] = useTransition();

  const [defaultPipelineId, setDefaultPipelineId] = useState('');
  const [defaultStage, setDefaultStage] = useState('');
  const [defaultAssignedTo, setDefaultAssignedTo] = useState('');

  const refresh = useCallback(() => {
    startLoading(async () => {
      const res = await getLeadGenConfig();
      setConfig(res.config ?? null);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadActivity = useCallback(() => {
    startLoadingActivity(async () => {
      const res = await getLeadGenActivity();
      setActivity(res.entries ?? []);
    });
  }, []);

  useEffect(() => {
    if (tab === 'activity') loadActivity();
  }, [tab, loadActivity]);

  const runAutoSetup = (pageId?: string) => {
    setSetupError(null);
    setNeedsMetaConnect(false);
    setPageOptions(null);
    startSetup(async () => {
      const res = await autoSetupFacebookLeadGen({
        pageId,
        defaultRouting: {
          pipelineId: defaultPipelineId,
          stage: defaultStage,
          assignedTo: defaultAssignedTo,
        },
      });
      if ('ok' in res && res.ok) {
        setConfig(res.config);
        toast({
          title: 'Connected',
          description: `${res.pickedPage.name} — ${res.importedFormCount} lead form${
            res.importedFormCount === 1 ? '' : 's'
          } now syncing in real-time.`,
        });
        return;
      }
      if ('needsMetaConnect' in res && res.needsMetaConnect) {
        setNeedsMetaConnect(true);
        if (res.error) setSetupError(res.error);
        return;
      }
      if ('needsPagePick' in res && res.needsPagePick) {
        setPageOptions(res.pages);
        return;
      }
      const errMsg = 'error' in res ? res.error : undefined;
      setSetupError(errMsg || 'Setup failed.');
      toast({ title: 'Setup failed', description: errMsg, variant: 'destructive' });
    });
  };

  const disconnect = () => {
    startSetup(async () => {
      const res = await disconnectFacebookLeadGen();
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Disconnected', description: 'Lead sync paused.' });
      refresh();
    });
  };

  const isConnected = !!config?.pageId && config.isActive;
  const isPaused = !!config?.pageId && !config.isActive;

  const toggleForm = (formId: string) => {
    setExpandedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  const updateFormConfig = (updated: FormConfig) => {
    if (!config) return;
    const nextForms = config.forms.map((f) => (f.formId === updated.formId ? updated : f));
    setConfig({ ...config, forms: nextForms });
  };

  const saveAdvanced = () => {
    if (!config) return;
    startSaving(async () => {
      const res = await saveLeadGenConfig({
        tenantId: config.tenantId,
        pageId: config.pageId,
        pageAccessToken: config.pageAccessToken,
        isActive: config.isActive,
        forms: config.forms,
      });
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setConfig(res.config);
      toast({ title: 'Saved', description: 'Advanced settings updated.' });
    });
  };

  const removeForm = (formId: string) => {
    startSaving(async () => {
      const res = await deleteLeadGenForm(formId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Removed', description: 'Form removed. Re-run setup to import it again.' });
      setConfig(res.config);
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <EntityListShell
      title="Facebook Ads → Leads"
      subtitle="Auto-create CRM leads from Facebook Lead Ad forms in real-time."
    >

      {/* Status banner */}
      <StatusBanner config={config} loading={loading} onDisconnect={disconnect} />

      {!config?.pageId ? (
        <SetupCard
          setting={setting}
          needsMetaConnect={needsMetaConnect}
          pageOptions={pageOptions}
          setupError={setupError}
          defaults={{ pipelineId: defaultPipelineId, stage: defaultStage, assignedTo: defaultAssignedTo }}
          onChangeDefaults={(d) => {
            setDefaultPipelineId(d.pipelineId);
            setDefaultStage(d.stage);
            setDefaultAssignedTo(d.assignedTo);
          }}
          onRun={runAutoSetup}
        />
      ) : (
        <>
          <div className="flex gap-1 border-b border-zoru-line">
            {(['overview', 'activity', 'advanced'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-b-2 border-zoru-primary text-zoru-primary'
                    : 'text-zoru-ink-muted hover:text-zoru-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <OverviewPanel config={config} setting={setting} onResync={() => runAutoSetup(config.pageId)} />
          )}

          {tab === 'activity' && (
            <ActivityPanel
              activity={activity}
              loading={loadingActivity}
              onReload={loadActivity}
            />
          )}

          {tab === 'advanced' && (
            <AdvancedPanel
              config={config}
              expandedForms={expandedForms}
              onToggle={toggleForm}
              onChange={updateFormConfig}
              onRemove={removeForm}
              onSave={saveAdvanced}
              saving={saving}
            />
          )}
        </>
      )}
    </EntityListShell>
  );
}

// ── Status banner ───────────────────────────────────────────────────────────

function StatusBanner({
  config,
  loading,
  onDisconnect,
}: {
  config: LeadGenConfig | null;
  loading: boolean;
  onDisconnect: () => void;
}) {
  if (loading && !config) {
    return <ZoruSkeleton className="h-12 w-full" />;
  }
  if (!config?.pageId) return null;
  if (config.isActive) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Connected — Page <code className="font-mono text-[12px]">{config.pageId}</code> ·{' '}
            {config.forms.length} form{config.forms.length === 1 ? '' : 's'} syncing in real-time.
          </span>
        </div>
        <ZoruButton size="sm" variant="outline" onClick={onDisconnect}>
          <PowerOff className="h-3.5 w-3.5" /> Pause sync
        </ZoruButton>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-300">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          Sync paused for Page <code className="font-mono text-[12px]">{config.pageId}</code>.
          Re-run setup to resume.
        </span>
      </div>
    </div>
  );
}

// ── Setup card ──────────────────────────────────────────────────────────────

function SetupCard({
  setting,
  needsMetaConnect,
  pageOptions,
  setupError,
  defaults,
  onChangeDefaults,
  onRun,
}: {
  setting: boolean;
  needsMetaConnect: boolean;
  pageOptions: FbPageSummary[] | null;
  setupError: string | null;
  defaults: { pipelineId: string; stage: string; assignedTo: string };
  onChangeDefaults: (d: { pipelineId: string; stage: string; assignedTo: string }) => void;
  onRun: (pageId?: string) => void;
}) {
  return (
    <ZoruCard className="p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]">
          <Facebook className="h-6 w-6" />
        </div>
        <h3 className="text-[16px] font-semibold text-zoru-ink">Set up lead sync in one click</h3>
        <p className="max-w-md text-[13px] text-zoru-ink-muted">
          We&apos;ll detect your connected Facebook Pages, pull every Lead Ad form, and start
          creating CRM leads in real-time. No manual tokens or webhooks.
        </p>
      </div>

      {needsMetaConnect ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-[13px] text-zoru-ink-muted">
            Connect your Meta account first — we&apos;ll request the permissions needed to read
            lead forms.
          </p>
          <ZoruButton asChild className="bg-[#1877F2] text-white hover:bg-[#1877F2]/90">
            <a href={META_OAUTH_HREF}>
              <Facebook className="h-4 w-4" /> Connect Facebook
            </a>
          </ZoruButton>
        </div>
      ) : pageOptions ? (
        <div className="mt-6 space-y-3">
          <p className="text-center text-[13px] text-zoru-ink-muted">
            You manage multiple Facebook Pages — pick the one for lead sync.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pageOptions.map((p) => (
              <button
                key={p.id}
                onClick={() => onRun(p.id)}
                disabled={setting}
                className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3 text-left text-[13px] text-zoru-ink transition-colors hover:bg-zoru-surface-2 disabled:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate font-mono text-[11px] text-zoru-ink-muted">{p.id}</div>
                </div>
                <ChevronRight className="ml-2 h-4 w-4 text-zoru-ink-muted" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <details className="rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <summary className="cursor-pointer text-[12px] font-medium text-zoru-ink">
              Optional: default routing for new leads
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(['pipelineId', 'stage', 'assignedTo'] as const).map((key) => (
                <div key={key}>
                  <ZoruLabel className="text-[11px]">
                    {key === 'pipelineId' ? 'Pipeline ID' : key === 'stage' ? 'Stage' : 'Assignee ID'}
                  </ZoruLabel>
                  <ZoruInput
                    value={defaults[key]}
                    onChange={(e) => onChangeDefaults({ ...defaults, [key]: e.target.value })}
                    className="mt-1 text-[12px]"
                    placeholder={key === 'stage' ? 'e.g. New' : 'ObjectId (optional)'}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zoru-ink-muted">
              Leave blank to assign to your default pipeline. You can edit per-form later under
              Advanced.
            </p>
          </details>

          <div className="flex justify-center">
            <ZoruButton onClick={() => onRun()} disabled={setting} size="lg">
              {setting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Run auto-setup
            </ZoruButton>
          </div>
        </div>
      )}

      {setupError ? (
        <p className="mt-4 text-center text-[12px] text-destructive">{setupError}</p>
      ) : null}
    </ZoruCard>
  );
}

// ── Overview panel ──────────────────────────────────────────────────────────

function OverviewPanel({
  config,
  setting,
  onResync,
}: {
  config: LeadGenConfig;
  setting: boolean;
  onResync: () => void;
}) {
  return (
    <ZoruCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-zoru-ink">
            Page <code className="font-mono">{config.pageId}</code>
          </div>
          <div className="mt-0.5 text-[12px] text-zoru-ink-muted">
            {config.forms.length} form{config.forms.length === 1 ? '' : 's'} imported with default
            field mapping.
          </div>
        </div>
        <ZoruButton variant="outline" onClick={onResync} disabled={setting} size="sm">
          {setting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-sync forms from Facebook
        </ZoruButton>
      </div>

      <div className="mt-5 divide-y divide-zoru-line rounded-lg border border-zoru-line">
        {config.forms.length === 0 ? (
          <div className="p-4 text-center text-[12px] text-zoru-ink-muted">
            No forms yet — create one in Meta Ads Manager, then click &ldquo;Re-sync forms&rdquo;.
          </div>
        ) : (
          config.forms.map((f) => (
            <div key={f.formId} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-zoru-ink">{f.formName}</div>
                <div className="truncate font-mono text-[11px] text-zoru-ink-muted">{f.formId}</div>
              </div>
              <div className="flex items-center gap-2 pl-3">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                  Live
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </ZoruCard>
  );
}

// ── Activity panel ──────────────────────────────────────────────────────────

function ActivityPanel({
  activity,
  loading,
  onReload,
}: {
  activity: ActivityEntry[];
  loading: boolean;
  onReload: () => void;
}) {
  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-zoru-line px-4 py-3">
        <span className="text-[13px] font-medium text-zoru-ink">Recent activity (last 100)</span>
        <ZoruButton variant="outline" onClick={onReload} disabled={loading} size="sm">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </ZoruButton>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((i) => (
            <ZoruSkeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="p-6 text-center text-[13px] text-zoru-ink-muted">
          No activity yet. Leads will appear here once your integration is live.
        </div>
      ) : (
        <div className="divide-y divide-zoru-line">
          {activity.map((entry, i) => (
            <ActivityRow key={entry._id ?? i} entry={entry} />
          ))}
        </div>
      )}
    </ZoruCard>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    {
      created: 'text-green-600 bg-green-50',
      skipped: 'text-amber-600 bg-amber-50',
      error: 'text-red-600 bg-red-50',
    }[entry.status] ?? 'text-zoru-ink-muted bg-zoru-bg';
  const date = new Date(entry.timestamp).toLocaleString();
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}
          >
            {entry.status}
          </span>
          <span className="truncate text-[13px] text-zoru-ink">{entry.leadName}</span>
          <span className="hidden truncate text-[11px] text-zoru-ink-muted sm:block">
            {entry.formName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 pl-3">
          {entry.crmLeadId && (
            <span className="font-mono text-[11px] text-zoru-ink-muted">
              {entry.crmLeadId.slice(-6)}
            </span>
          )}
          <span className="text-[11px] text-zoru-ink-muted">{date}</span>
          {entry.errorMessage && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
      {expanded && entry.errorMessage && (
        <div className="mt-1.5 rounded bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">
          {entry.errorMessage}
        </div>
      )}
    </div>
  );
}

// ── Advanced panel ──────────────────────────────────────────────────────────

const CRM_FIELD_OPTIONS = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job Title' },
  { value: 'description', label: 'Description' },
  { value: 'notes', label: 'Notes' },
  { value: 'ignore', label: 'Ignore' },
];

function AdvancedPanel({
  config,
  expandedForms,
  onToggle,
  onChange,
  onRemove,
  onSave,
  saving,
}: {
  config: LeadGenConfig;
  expandedForms: Set<string>;
  onToggle: (formId: string) => void;
  onChange: (fc: FormConfig) => void;
  onRemove: (formId: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-zoru-ink-muted">
          Override default field mapping and per-campaign routing. Most users never need this.
        </p>
        <ZoruButton onClick={onSave} disabled={saving} size="sm">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </ZoruButton>
      </div>

      {config.forms.length === 0 ? (
        <ZoruCard className="p-6 text-center text-[13px] text-zoru-ink-muted">
          No forms imported yet.
        </ZoruCard>
      ) : (
        config.forms.map((fc) => (
          <FormConfigPanel
            key={fc.formId}
            fc={fc}
            isExpanded={expandedForms.has(fc.formId)}
            onToggle={() => onToggle(fc.formId)}
            onChange={onChange}
            onRemove={() => onRemove(fc.formId)}
          />
        ))
      )}
    </div>
  );
}

function FormConfigPanel({
  fc,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
}: {
  fc: FormConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (fc: FormConfig) => void;
  onRemove: () => void;
}) {
  const updateMapping = (idx: number, crmField: string) => {
    const next = fc.fieldMapping.map((m, i) => (i === idx ? { ...m, crmField } : m));
    onChange({ ...fc, fieldMapping: next });
  };
  const updateRouting = (key: keyof FormConfig['defaultRouting'], value: string) => {
    onChange({ ...fc, defaultRouting: { ...fc.defaultRouting, [key]: value } });
  };
  const addCampaignRule = () => {
    onChange({
      ...fc,
      campaignRules: [
        ...fc.campaignRules,
        { campaignId: '', adsetId: '', pipelineId: '', stage: '', assignedTo: '' },
      ],
    });
  };
  const updateCampaignRule = (idx: number, updated: CampaignRule) => {
    onChange({
      ...fc,
      campaignRules: fc.campaignRules.map((r, i) => (i === idx ? updated : r)),
    });
  };
  const removeCampaignRule = (idx: number) => {
    onChange({ ...fc, campaignRules: fc.campaignRules.filter((_, i) => i !== idx) });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zoru-bg"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-zoru-ink-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zoru-ink-muted" />
          )}
          <div>
            <div className="text-[13px] font-medium text-zoru-ink">{fc.formName}</div>
            <div className="font-mono text-[11px] text-zoru-ink-muted">{fc.formId}</div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-6 border-t border-zoru-line p-4">
          <div>
            <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Field Mapping
            </h4>
            <div className="space-y-2">
              {fc.fieldMapping.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <ZoruInput
                    value={mapping.fbField}
                    onChange={(e) => {
                      const next = fc.fieldMapping.map((m, i) =>
                        i === idx ? { ...m, fbField: e.target.value } : m,
                      );
                      onChange({ ...fc, fieldMapping: next });
                    }}
                    placeholder="Facebook field"
                    className="flex-1 text-[12px]"
                  />
                  <select
                    value={mapping.crmField}
                    onChange={(e) => updateMapping(idx, e.target.value)}
                    className="rounded-md border border-zoru-line bg-zoru-surface px-2 py-1.5 text-[12px] text-zoru-ink focus:outline-none focus:ring-1 focus:ring-zoru-primary"
                  >
                    {CRM_FIELD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Default Routing
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {(['pipelineId', 'stage', 'assignedTo'] as const).map((key) => (
                <div key={key}>
                  <ZoruLabel className="text-[11px]">
                    {key === 'pipelineId' ? 'Pipeline ID' : key === 'stage' ? 'Stage' : 'Assignee ID'}
                  </ZoruLabel>
                  <ZoruInput
                    value={fc.defaultRouting[key]}
                    onChange={(e) => updateRouting(key, e.target.value)}
                    className="mt-1 text-[12px]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Campaign Rules
              </h4>
              <button
                onClick={addCampaignRule}
                className="text-[11px] text-zoru-primary hover:underline"
              >
                + Add rule
              </button>
            </div>
            {fc.campaignRules.length === 0 ? (
              <p className="text-[11px] text-zoru-ink-muted">
                No rules — all leads use Default Routing.
              </p>
            ) : (
              <div className="space-y-3">
                {fc.campaignRules.map((rule, idx) => (
                  <div key={idx} className="space-y-2 rounded-md border border-zoru-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zoru-ink-muted">Rule {idx + 1}</span>
                      <button
                        onClick={() => removeCampaignRule(idx)}
                        className="text-zoru-ink-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ZoruInput
                        value={rule.campaignId ?? ''}
                        onChange={(e) =>
                          updateCampaignRule(idx, { ...rule, campaignId: e.target.value || undefined })
                        }
                        placeholder="Campaign ID (optional)"
                        className="text-[12px]"
                      />
                      <ZoruInput
                        value={rule.adsetId ?? ''}
                        onChange={(e) =>
                          updateCampaignRule(idx, { ...rule, adsetId: e.target.value || undefined })
                        }
                        placeholder="Ad Set ID (optional)"
                        className="text-[12px]"
                      />
                      <ZoruInput
                        value={rule.pipelineId}
                        onChange={(e) => updateCampaignRule(idx, { ...rule, pipelineId: e.target.value })}
                        placeholder="Pipeline ID"
                        className="text-[12px]"
                      />
                      <ZoruInput
                        value={rule.stage}
                        onChange={(e) => updateCampaignRule(idx, { ...rule, stage: e.target.value })}
                        placeholder="Stage"
                        className="text-[12px]"
                      />
                      <ZoruInput
                        value={rule.assignedTo}
                        onChange={(e) => updateCampaignRule(idx, { ...rule, assignedTo: e.target.value })}
                        placeholder="Assignee ID"
                        className="text-[12px] col-span-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <ZoruButton
              variant="outline"
              onClick={onRemove}
              className="text-destructive hover:bg-destructive/10"
              size="sm"
            >
              <Trash2 className="h-4 w-4" /> Remove this form from sync
            </ZoruButton>
          </div>
        </div>
      )}
    </ZoruCard>
  );
}
