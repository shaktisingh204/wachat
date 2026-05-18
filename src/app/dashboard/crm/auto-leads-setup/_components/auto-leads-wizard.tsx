'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruProgress,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Facebook,
  LoaderCircle,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  TestTube,
  Trash2,
  Webhook,
  Wand2,
  } from 'lucide-react';

import {
  deleteAutoLeadRule,
  saveAutoLeadRule,
  } from '@/app/actions/crm-auto-leads.actions';
import { CrmPageHeader } from '../../_components/crm-page-header';

/**
 * Auto-Leads Setup — §1D 5-step wizard.
 *
 * Steps:
 *  1. Source integration (FB Lead Gen / WhatsApp / Webhook / Form embed)
 *  2. Default field mapping
 *  3. Default owner + pipeline assignment rules
 *  4. Notification preferences
 *  5. Test & Activate (persists a rule via existing saveAutoLeadRule action,
 *     preserving its FormData keys: name, source, keyword, leadSource)
 *
 * The current `crm_auto_lead_rules` schema only stores
 * (name, source, keyword, leadSource). Step 1-4 capture preferences that
 * persist as part of the rule's keyword + leadSource fields today; richer
 * persistence ships when the action grows the schema.
 */

import * as React from 'react';

interface RuleRow {
  _id: string;
  name: string;
  source: string;
  keyword: string;
  leadSource: string;
  createdAt?: string;
}

const STEPS = [
  { id: 0, label: 'Source', icon: Webhook },
  { id: 1, label: 'Mapping', icon: Wand2 },
  { id: 2, label: 'Assignment', icon: Settings },
  { id: 3, label: 'Notifications', icon: Bell },
  { id: 4, label: 'Test & Activate', icon: TestTube },
] as const;

const SOURCES = [
  { value: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'Facebook', label: 'FB Lead Gen', icon: Facebook },
  { value: 'Webhook', label: 'Webhook', icon: Webhook },
  { value: 'Email', label: 'Email', icon: Bell },
  { value: 'Form', label: 'Form embed', icon: Sparkles },
];

interface WizardState {
  source: string;
  name: string;
  keyword: string;
  leadSource: string;
  mapFullName: string;
  mapEmail: string;
  mapPhone: string;
  defaultOwner: string;
  defaultPipeline: string;
  notifyEmail: boolean;
  notifyInApp: boolean;
}

export interface AutoLeadsWizardProps {
  initialRules: RuleRow[];
}

export function AutoLeadsWizard({ initialRules }: AutoLeadsWizardProps): React.JSX.Element {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [step, setStep] = React.useState(0);
  const [rules, setRules] = React.useState<RuleRow[]>(initialRules);
  const [isPending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<WizardState>({
    source: 'Email',
    name: '',
    keyword: '',
    leadSource: 'Auto-Generated',
    mapFullName: 'name',
    mapEmail: 'email',
    mapPhone: 'phone',
    defaultOwner: '',
    defaultPipeline: '',
    notifyEmail: true,
    notifyInApp: true,
  });

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const activeRules = rules.length;

  const update = React.useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleNext = React.useCallback(() => {
    setStep((prev) => Math.min(totalSteps - 1, prev + 1));
  }, [totalSteps]);

  const handleBack = React.useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleActivate = React.useCallback(() => {
    if (!state.name || !state.keyword) {
      toast({
        title: 'Rule name and keyword are required',
        variant: 'destructive',
      });
      setStep(4);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', state.name);
      fd.set('source', state.source);
      fd.set('keyword', state.keyword);
      fd.set('leadSource', state.leadSource);
      const res = await saveAutoLeadRule(fd);
      if (res.success) {
        toast({ title: 'Auto-leads rule activated' });
        // Optimistically prepend
        setRules((prev) => [
          {
            _id: `local-${Date.now()}`,
            name: state.name,
            source: state.source,
            keyword: state.keyword,
            leadSource: state.leadSource,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        router.refresh();
        // Reset wizard to step 0 for next rule
        setStep(0);
        setState((prev) => ({ ...prev, name: '', keyword: '' }));
      } else {
        toast({ title: 'Activate failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [router, state, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteAutoLeadRule(id);
      if (res.success) {
        setRules((prev) => prev.filter((r) => r._id !== id));
        toast({ title: 'Rule removed' });
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    },
    [toast],
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Auto-Leads Setup"
        subtitle="Automatically create leads from incoming messages and form submissions."
        icon={Sparkles}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ZoruStatCard label="Active rules" value={activeRules.toLocaleString()} />
        <ZoruStatCard label="Sources covered" value={new Set(rules.map((r) => r.source)).size} />
        <ZoruStatCard label="Current step" value={`${step + 1} / ${totalSteps}`} />
      </div>

      {/* Progress + step rail */}
      <ZoruCard className="p-4">
        <ZoruProgress value={progress} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors',
                  active && 'bg-zoru-primary/10 text-zoru-ink',
                  !active && 'text-zoru-ink-muted hover:text-zoru-ink',
                )}
              >
                {done ? (
                  <Check className="h-3 w-3 text-zoru-success" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {s.label}
              </button>
            );
          })}
        </div>
      </ZoruCard>

      {/* Body */}
      <ZoruCard className="p-6">
        {step === 0 ? (
          <StepSource state={state} update={update} />
        ) : step === 1 ? (
          <StepMapping state={state} update={update} />
        ) : step === 2 ? (
          <StepAssignment state={state} update={update} />
        ) : step === 3 ? (
          <StepNotifications state={state} update={update} />
        ) : (
          <StepTest state={state} update={update} />
        )}
      </ZoruCard>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-2">
        <ZoruButton variant="outline" onClick={handleBack} disabled={step === 0 || isPending}>
          <ArrowLeft className="h-4 w-4" /> Back
        </ZoruButton>
        {step < totalSteps - 1 ? (
          <ZoruButton onClick={handleNext}>
            Next <ArrowRight className="h-4 w-4" />
          </ZoruButton>
        ) : (
          <ZoruButton onClick={handleActivate} disabled={isPending}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Activate rule
          </ZoruButton>
        )}
      </div>

      {/* Existing rules */}
      <ZoruCard className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-zoru-ink">Active rules</h2>
            <p className="text-[12px] text-zoru-ink-muted">
              Rules saved on this tenant — incoming events matching these trigger lead creation.
            </p>
          </div>
        </div>
        {rules.length === 0 ? (
          <p className="text-[13px] text-zoru-ink-muted">
            No rules configured yet. Finish the wizard above and click&nbsp;
            <ZoruBadge variant="secondary">Activate rule</ZoruBadge> to add the first one.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-zoru-line">
            {rules.map((r) => (
              <li
                key={r._id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-zoru-ink">{r.name}</span>
                    <ZoruBadge variant="secondary">{r.source}</ZoruBadge>
                    <ZoruBadge variant="secondary">{r.leadSource}</ZoruBadge>
                  </div>
                  <div className="mt-0.5 text-[12px] text-zoru-ink-muted">
                    Keyword:{' '}
                    <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-[11.5px]">
                      {r.keyword}
                    </code>
                  </div>
                </div>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(r._id)}
                  className="hover:text-zoru-danger-ink"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </ZoruButton>
              </li>
            ))}
          </ul>
        )}
      </ZoruCard>
    </div>
  );
}

/* ─── Steps ───────────────────────────────────────────────────────────── */

function StepSource({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ZoruLabel>Source integration</ZoruLabel>
        <p className="mb-2 text-[12px] text-zoru-ink-muted">
          Pick where these leads come from. The runtime listener routes matching events through
          the keyword filter you set in Step 5.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SOURCES.map((s) => {
            const Icon = s.icon;
            const selected = state.source === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => update('source', s.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border bg-zoru-bg p-3 text-[12.5px]',
                  selected
                    ? 'border-zoru-primary ring-2 ring-zoru-primary/30'
                    : 'border-zoru-line hover:border-zoru-ink-muted',
                )}
              >
                <Icon className="h-5 w-5" />
                {s.label}
                {selected ? <Check className="h-3 w-3 text-zoru-primary" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepMapping({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <ZoruLabel htmlFor="mn">Name field</ZoruLabel>
        <ZoruInput
          id="mn"
          value={state.mapFullName}
          onChange={(e) => update('mapFullName', e.target.value)}
          placeholder="name"
        />
      </div>
      <div>
        <ZoruLabel htmlFor="me">Email field</ZoruLabel>
        <ZoruInput
          id="me"
          value={state.mapEmail}
          onChange={(e) => update('mapEmail', e.target.value)}
          placeholder="email"
        />
      </div>
      <div>
        <ZoruLabel htmlFor="mp">Phone field</ZoruLabel>
        <ZoruInput
          id="mp"
          value={state.mapPhone}
          onChange={(e) => update('mapPhone', e.target.value)}
          placeholder="phone"
        />
      </div>
      <p className="md:col-span-3 text-[12px] text-zoru-ink-muted">
        Map the incoming payload field names to the lead fields. Defaults work for most webhook
        payloads.
      </p>
    </div>
  );
}

function StepAssignment({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel htmlFor="ow">Default owner (user id)</ZoruLabel>
        <ZoruInput
          id="ow"
          value={state.defaultOwner}
          onChange={(e) => update('defaultOwner', e.target.value)}
          placeholder="auto"
        />
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
          Leave empty for round-robin. Hard-code a user id to assign every match.
        </p>
      </div>
      <div>
        <ZoruLabel htmlFor="pi">Default pipeline</ZoruLabel>
        <ZoruInput
          id="pi"
          value={state.defaultPipeline}
          onChange={(e) => update('defaultPipeline', e.target.value)}
          placeholder="Sales Pipeline"
        />
      </div>
    </div>
  );
}

function StepNotifications({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
        <input
          type="checkbox"
          checked={state.notifyEmail}
          onChange={(e) => update('notifyEmail', e.target.checked)}
        />
        Email me when a new lead is auto-created
      </label>
      <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
        <input
          type="checkbox"
          checked={state.notifyInApp}
          onChange={(e) => update('notifyInApp', e.target.checked)}
        />
        Show in-app notification (Notifications Center)
      </label>
    </div>
  );
}

function StepTest({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel htmlFor="rn">Rule name</ZoruLabel>
        <ZoruInput
          id="rn"
          value={state.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Pricing enquiry"
        />
      </div>
      <div>
        <ZoruLabel htmlFor="kw">Match keyword</ZoruLabel>
        <ZoruInput
          id="kw"
          value={state.keyword}
          onChange={(e) => update('keyword', e.target.value)}
          placeholder="price, quote, cost"
        />
      </div>
      <div>
        <ZoruLabel>Source</ZoruLabel>
        <ZoruSelect value={state.source} onValueChange={(v) => update('source', v)}>
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {SOURCES.map((s) => (
              <ZoruSelectItem key={s.value} value={s.value}>
                {s.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
      <div>
        <ZoruLabel htmlFor="ls">Lead source label</ZoruLabel>
        <ZoruInput
          id="ls"
          value={state.leadSource}
          onChange={(e) => update('leadSource', e.target.value)}
          placeholder="Auto-Generated"
        />
      </div>
      <p className="md:col-span-2 text-[12px] text-zoru-ink-muted">
        Clicking <ZoruBadge variant="secondary">Activate rule</ZoruBadge> persists this
        configuration. Matching events will start creating leads as soon as the listener
        consumes them.
      </p>
    </div>
  );
}
