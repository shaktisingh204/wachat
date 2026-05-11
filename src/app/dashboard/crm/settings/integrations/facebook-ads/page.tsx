'use client';

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  Megaphone,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getLeadGenConfig,
  saveLeadGenConfig,
  deleteLeadGenForm,
  getLeadGenConfigForms,
  getLeadGenActivity,
} from '@/lib/rust-client/wachat-facebook-leadgen-config';
import type {
  LeadGenConfig,
  LeadGenForm,
  ActivityEntry,
  FormConfig,
  FieldMapping,
  CampaignRule,
} from '@/lib/rust-client/wachat-facebook-leadgen-config';

type Tab = 'connection' | 'forms' | 'activity';

const CRM_FIELD_OPTIONS = [
  { value: 'firstName',   label: 'First Name' },
  { value: 'lastName',    label: 'Last Name' },
  { value: 'email',       label: 'Email' },
  { value: 'phone',       label: 'Phone' },
  { value: 'company',     label: 'Company' },
  { value: 'title',       label: 'Job Title' },
  { value: 'description', label: 'Description' },
  { value: 'notes',       label: 'Notes' },
  { value: 'ignore',      label: 'Ignore' },
];

const STANDARD_FB_FIELDS = [
  'full_name',
  'email',
  'phone_number',
  'company_name',
  'job_title',
];

export default function FacebookAdsIntegrationPage() {
  const { toast } = useZoruToast();
  const [tab, setTab] = useState<Tab>('connection');
  const [config, setConfig] = useState<LeadGenConfig | null>(null);
  const [forms, setForms] = useState<LeadGenForm[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [loadingForms, startLoadingForms] = useTransition();
  const [loadingActivity, startLoadingActivity] = useTransition();

  // Local editable state for the connection tab
  const [pageId, setPageId] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [isActive, setIsActive] = useState(false);

  // Local editable form configs
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>([]);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const res = await getLeadGenConfig();
      if (res.config) {
        setConfig(res.config);
        setPageId(res.config.pageId ?? '');
        setPageAccessToken(res.config.pageAccessToken ?? '');
        setIsActive(res.config.isActive ?? false);
        setFormConfigs(res.config.forms ?? []);
      }
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loadForms = useCallback(() => {
    startLoadingForms(async () => {
      const res = await getLeadGenConfigForms();
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setForms(res.forms ?? []);
      }
    });
  }, [toast]);

  const loadActivity = useCallback(() => {
    startLoadingActivity(async () => {
      const res = await getLeadGenActivity();
      setActivity(res.entries ?? []);
    });
  }, []);

  useEffect(() => {
    if (tab === 'forms') loadForms();
    if (tab === 'activity') loadActivity();
  }, [tab, loadForms, loadActivity]);

  // ── Connection tab save ──────────────────────────────────────────────────

  const saveConnection = () => {
    startSaving(async () => {
      const res = await saveLeadGenConfig({
        tenantId: config?.tenantId ?? '',
        pageId,
        pageAccessToken,
        isActive,
        forms: formConfigs,
      });
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setConfig(res.config);
        toast({ title: 'Saved', description: 'Connection settings saved.' });
      }
    });
  };

  // ── Forms tab helpers ────────────────────────────────────────────────────

  const toggleForm = (formId: string) => {
    setExpandedForms(prev => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId); else next.add(formId);
      return next;
    });
  };

  const getOrCreateFormConfig = (form: LeadGenForm): FormConfig => {
    const existing = formConfigs.find(f => f.formId === form.id);
    if (existing) return existing;
    return {
      formId: form.id,
      formName: form.name,
      fieldMapping: STANDARD_FB_FIELDS.map(fb => ({
        fbField: fb,
        crmField: defaultCrmField(fb),
      })),
      defaultRouting: { pipelineId: '', stage: '', assignedTo: '' },
      campaignRules: [],
    };
  };

  function defaultCrmField(fb: string): string {
    const map: Record<string, string> = {
      full_name: 'firstName',
      email: 'email',
      phone_number: 'phone',
      company_name: 'company',
      job_title: 'title',
    };
    return map[fb] ?? 'ignore';
  }

  const updateFormConfig = (updated: FormConfig) => {
    setFormConfigs(prev => {
      const idx = prev.findIndex(f => f.formId === updated.formId);
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  const saveFormConfigs = () => {
    startSaving(async () => {
      const res = await saveLeadGenConfig({
        tenantId: config?.tenantId ?? '',
        pageId: config?.pageId ?? pageId,
        pageAccessToken: config?.pageAccessToken ?? pageAccessToken,
        isActive: config?.isActive ?? isActive,
        forms: formConfigs,
      });
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setConfig(res.config);
        toast({ title: 'Saved', description: 'Form configurations saved.' });
      }
    });
  };

  const removeForm = (formId: string) => {
    startSaving(async () => {
      const res = await deleteLeadGenForm(formId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setFormConfigs(prev => prev.filter(f => f.formId !== formId));
        toast({ title: 'Removed', description: 'Form configuration removed.' });
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const tokenExpired = config && !config.isActive && config.pageId;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Facebook Ads → Leads"
        subtitle="Auto-create CRM leads from Facebook Lead Ad forms in real-time."
        icon={Megaphone}
      />

      {tokenExpired ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Page access token expired — reconnect to resume lead sync.
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zoru-line">
        {(['connection', 'forms', 'activity'] as Tab[]).map(t => (
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

      {/* ── Connection Tab ── */}
      {tab === 'connection' && (
        <ZoruCard className="p-6">
          {loading ? (
            <div className="space-y-4">
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
              <ZoruSkeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <ZoruLabel htmlFor="page_id">Facebook Page ID</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="page_id"
                    value={pageId}
                    onChange={e => setPageId(e.target.value)}
                    placeholder="e.g. 123456789012345"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zoru-ink-muted">
                  Found in Meta Business Suite → Settings → Page Info.
                </p>
              </div>

              <div>
                <ZoruLabel htmlFor="page_token">Page Access Token</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="page_token"
                    type="password"
                    value={pageAccessToken}
                    onChange={e => setPageAccessToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                  />
                </div>
                <p className="mt-1 text-[11px] text-zoru-ink-muted">
                  Generate a long-lived token in Meta Developer Console →
                  Tools → Access Token Debugger. Requires <code>leads_retrieval</code> permission.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
                <div>
                  <div className="text-[13px] text-zoru-ink">Active</div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    Enable real-time lead sync.
                  </div>
                </div>
                <ZoruSwitch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  aria-label="Integration active"
                />
              </div>

              <div className="rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3 text-[12px] text-zoru-ink-muted space-y-1">
                <p className="font-medium text-zoru-ink text-[13px]">One-time Meta App Setup</p>
                <p>In your Meta App Dashboard, go to <strong>Webhooks → Page</strong> and add <code>leadgen</code> to the subscribed fields for your Page webhook.</p>
              </div>

              <div className="flex justify-end pt-1">
                <ZoruButton onClick={saveConnection} disabled={saving}>
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Save Connection
                </ZoruButton>
              </div>
            </div>
          )}
        </ZoruCard>
      )}

      {/* ── Forms Tab ── */}
      {tab === 'forms' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-zoru-ink-muted">
              Configure field mapping and routing rules per Lead Ad form.
            </p>
            <div className="flex gap-2">
              <ZoruButton variant="outline" onClick={loadForms} disabled={loadingForms}>
                {loadingForms
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
                Refresh
              </ZoruButton>
              <ZoruButton onClick={saveFormConfigs} disabled={saving}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save All
              </ZoruButton>
            </div>
          </div>

          {loadingForms ? (
            <div className="space-y-3">
              {[1, 2].map(i => <ZoruSkeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : forms.length === 0 ? (
            <ZoruCard className="p-6 text-center text-[13px] text-zoru-ink-muted">
              No forms found. Make sure the Page ID and Access Token are saved in the Connection tab.
            </ZoruCard>
          ) : (
            forms.map(form => {
              const fc = getOrCreateFormConfig(form);
              const isExpanded = expandedForms.has(form.id);
              return (
                <FormConfigPanel
                  key={form.id}
                  form={form}
                  config={fc}
                  isExpanded={isExpanded}
                  onToggle={() => toggleForm(form.id)}
                  onChange={updateFormConfig}
                  onRemove={() => removeForm(form.id)}
                />
              );
            })
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {tab === 'activity' && (
        <ZoruCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-zoru-line px-4 py-3">
            <span className="text-[13px] font-medium text-zoru-ink">Recent activity (last 100)</span>
            <ZoruButton variant="outline" onClick={loadActivity} disabled={loadingActivity}>
              {loadingActivity
                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              Refresh
            </ZoruButton>
          </div>

          {loadingActivity ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map(i => <ZoruSkeleton key={i} className="h-10 w-full" />)}
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
      )}
    </div>
  );
}

// ── FormConfigPanel ──────────────────────────────────────────────────────────

function FormConfigPanel({
  form,
  config,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
}: {
  form: LeadGenForm;
  config: FormConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (fc: FormConfig) => void;
  onRemove: () => void;
}) {
  const updateMapping = (idx: number, crmField: string) => {
    const next = config.fieldMapping.map((m, i) =>
      i === idx ? { ...m, crmField } : m
    );
    onChange({ ...config, fieldMapping: next });
  };

  const addMappingRow = () => {
    onChange({
      ...config,
      fieldMapping: [...config.fieldMapping, { fbField: '', crmField: 'ignore' }],
    });
  };

  const removeMappingRow = (idx: number) => {
    onChange({ ...config, fieldMapping: config.fieldMapping.filter((_, i) => i !== idx) });
  };

  const updateRouting = (key: keyof FormConfig['defaultRouting'], value: string) => {
    onChange({ ...config, defaultRouting: { ...config.defaultRouting, [key]: value } });
  };

  const addCampaignRule = () => {
    onChange({
      ...config,
      campaignRules: [...config.campaignRules, {
        campaignId: '',
        adsetId: '',
        pipelineId: '',
        stage: '',
        assignedTo: '',
      }],
    });
  };

  const updateCampaignRule = (idx: number, updated: CampaignRule) => {
    const next = config.campaignRules.map((r, i) => i === idx ? updated : r);
    onChange({ ...config, campaignRules: next });
  };

  const removeCampaignRule = (idx: number) => {
    onChange({ ...config, campaignRules: config.campaignRules.filter((_, i) => i !== idx) });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zoru-bg transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-zoru-ink-muted" />
            : <ChevronRight className="h-4 w-4 text-zoru-ink-muted" />
          }
          <div>
            <div className="text-[13px] font-medium text-zoru-ink">{form.name}</div>
            <div className="text-[11px] text-zoru-ink-muted">ID: {form.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {form.leads_count !== undefined && (
            <span className="text-[11px] text-zoru-ink-muted">{form.leads_count} leads</span>
          )}
          <span className={`text-[11px] font-medium ${form.status === 'ACTIVE' ? 'text-green-600' : 'text-zoru-ink-muted'}`}>
            {form.status}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-zoru-line p-4 space-y-6">
          {/* Field Mapping */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Field Mapping
              </h4>
              <button
                onClick={addMappingRow}
                className="flex items-center gap-1 text-[11px] text-zoru-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add row
              </button>
            </div>
            <div className="space-y-2">
              {config.fieldMapping.map((mapping, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <ZoruInput
                    value={mapping.fbField}
                    onChange={e => {
                      const next = config.fieldMapping.map((m, i) =>
                        i === idx ? { ...m, fbField: e.target.value } : m
                      );
                      onChange({ ...config, fieldMapping: next });
                    }}
                    placeholder="Facebook field (e.g. full_name)"
                    className="flex-1 text-[12px]"
                  />
                  <select
                    value={mapping.crmField}
                    onChange={e => updateMapping(idx, e.target.value)}
                    className="rounded-md border border-zoru-line bg-zoru-surface px-2 py-1.5 text-[12px] text-zoru-ink focus:outline-none focus:ring-1 focus:ring-zoru-primary"
                  >
                    {CRM_FIELD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeMappingRow(idx)}
                    className="text-zoru-ink-muted hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zoru-ink-muted">
              Unmapped fields are stored as Q&A in Description.
            </p>
          </div>

          {/* Default Routing */}
          <div>
            <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Default Routing
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {(['pipelineId', 'stage', 'assignedTo'] as const).map(key => (
                <div key={key}>
                  <ZoruLabel className="text-[11px]">
                    {key === 'pipelineId' ? 'Pipeline ID' : key === 'stage' ? 'Stage' : 'Assignee ID'}
                  </ZoruLabel>
                  <ZoruInput
                    value={config.defaultRouting[key]}
                    onChange={e => updateRouting(key, e.target.value)}
                    placeholder={key === 'pipelineId' ? 'ObjectId' : key === 'stage' ? 'e.g. New' : 'User ObjectId'}
                    className="mt-1 text-[12px]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Campaign Rules
                <span className="ml-1 font-normal normal-case tracking-normal text-zoru-ink-muted">
                  (top-down, first match wins)
                </span>
              </h4>
              <button
                onClick={addCampaignRule}
                className="flex items-center gap-1 text-[11px] text-zoru-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add rule
              </button>
            </div>
            {config.campaignRules.length === 0 ? (
              <p className="text-[11px] text-zoru-ink-muted">
                No rules — all leads use Default Routing above.
              </p>
            ) : (
              <div className="space-y-3">
                {config.campaignRules.map((rule, idx) => (
                  <div key={idx} className="rounded-md border border-zoru-line p-3 space-y-2">
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
                      <div>
                        <ZoruLabel className="text-[11px]">Campaign ID (optional)</ZoruLabel>
                        <ZoruInput
                          value={rule.campaignId ?? ''}
                          onChange={e => updateCampaignRule(idx, { ...rule, campaignId: e.target.value || undefined })}
                          placeholder="Wildcard if empty"
                          className="mt-1 text-[12px]"
                        />
                      </div>
                      <div>
                        <ZoruLabel className="text-[11px]">Ad Set ID (optional)</ZoruLabel>
                        <ZoruInput
                          value={rule.adsetId ?? ''}
                          onChange={e => updateCampaignRule(idx, { ...rule, adsetId: e.target.value || undefined })}
                          placeholder="Wildcard if empty"
                          className="mt-1 text-[12px]"
                        />
                      </div>
                      <div>
                        <ZoruLabel className="text-[11px]">Pipeline ID</ZoruLabel>
                        <ZoruInput
                          value={rule.pipelineId}
                          onChange={e => updateCampaignRule(idx, { ...rule, pipelineId: e.target.value })}
                          className="mt-1 text-[12px]"
                        />
                      </div>
                      <div>
                        <ZoruLabel className="text-[11px]">Stage</ZoruLabel>
                        <ZoruInput
                          value={rule.stage}
                          onChange={e => updateCampaignRule(idx, { ...rule, stage: e.target.value })}
                          className="mt-1 text-[12px]"
                        />
                      </div>
                      <div>
                        <ZoruLabel className="text-[11px]">Assignee ID</ZoruLabel>
                        <ZoruInput
                          value={rule.assignedTo}
                          onChange={e => updateCampaignRule(idx, { ...rule, assignedTo: e.target.value })}
                          className="mt-1 text-[12px]"
                        />
                      </div>
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
            >
              <Trash2 className="h-4 w-4" />
              Remove Form
            </ZoruButton>
          </div>
        </div>
      )}
    </ZoruCard>
  );
}

// ── ActivityRow ──────────────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = {
    created: 'text-green-600 bg-green-50',
    skipped: 'text-amber-600 bg-amber-50',
    error:   'text-red-600 bg-red-50',
  }[entry.status] ?? 'text-zoru-ink-muted bg-zoru-bg';

  const date = new Date(entry.timestamp).toLocaleString();

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>
            {entry.status}
          </span>
          <span className="truncate text-[13px] text-zoru-ink">{entry.leadName}</span>
          <span className="hidden truncate text-[11px] text-zoru-ink-muted sm:block">
            {entry.formName}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 pl-3">
          {entry.crmLeadId && (
            <span className="text-[11px] text-zoru-ink-muted font-mono">
              {entry.crmLeadId.slice(-6)}
            </span>
          )}
          <span className="text-[11px] text-zoru-ink-muted">{date}</span>
          {entry.errorMessage && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              {expanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      {expanded && entry.errorMessage && (
        <div className="mt-1.5 rounded bg-red-50 px-3 py-2 text-[11px] text-red-700 font-mono">
          {entry.errorMessage}
        </div>
      )}
    </div>
  );
}
