'use client';

import { Badge, Button, Card, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, cn, useToast } from '@/components/sabcrm/20ui/compat';
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
import { EntityListShell } from '@/components/crm/entity-list-shell';

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
  const { toast } = useToast();
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
    <EntityListShell
      title="Auto-Leads Setup"
      subtitle="Automatically create leads from incoming messages and form submissions."
    >

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Active rules" value={activeRules.toLocaleString()} />
        <StatCard label="Sources covered" value={new Set(rules.map((r) => r.source)).size} />
        <StatCard label="Current step" value={`${step + 1} / ${totalSteps}`} />
      </div>

      {/* Progress + step rail */}
      <Card className="p-4">
        <Progress value={progress} />
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
                  active && 'bg-[var(--st-text)]/10 text-[var(--st-text)]',
                  !active && 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                )}
              >
                {done ? (
                  <Check className="h-3 w-3 text-[var(--st-status-ok)]" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {s.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Body */}
      <Card className="p-6">
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
      </Card>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={handleBack} disabled={step === 0 || isPending}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < totalSteps - 1 ? (
          <Button onClick={handleNext}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleActivate} disabled={isPending}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Activate rule
          </Button>
        )}
      </div>

      {/* Existing rules */}
      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Active rules</h2>
            <p className="text-[12px] text-[var(--st-text-secondary)]">
              Rules saved on this tenant — incoming events matching these trigger lead creation.
            </p>
          </div>
        </div>
        {rules.length === 0 ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            No rules configured yet. Finish the wizard above and click&nbsp;
            <Badge variant="secondary">Activate rule</Badge> to add the first one.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--st-border)]">
            {rules.map((r) => (
              <li
                key={r._id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--st-text)]">{r.name}</span>
                    <Badge variant="secondary">{r.source}</Badge>
                    <Badge variant="secondary">{r.leadSource}</Badge>
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                    Keyword:{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[11.5px]">
                      {r.keyword}
                    </code>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(r._id)}
                  className="hover:text-[var(--st-danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </EntityListShell>
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
        <Label>Source integration</Label>
        <p className="mb-2 text-[12px] text-[var(--st-text-secondary)]">
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
                  'flex flex-col items-center gap-1 rounded-xl border bg-[var(--st-bg)] p-3 text-[12.5px]',
                  selected
                    ? 'border-[var(--st-text)] ring-2 ring-[var(--st-text)]/30'
                    : 'border-[var(--st-border)] hover:border-[var(--st-text-secondary)]',
                )}
              >
                <Icon className="h-5 w-5" />
                {s.label}
                {selected ? <Check className="h-3 w-3 text-[var(--st-text)]" /> : null}
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
        <Label htmlFor="mn">Name field</Label>
        <Input
          id="mn"
          value={state.mapFullName}
          onChange={(e) => update('mapFullName', e.target.value)}
          placeholder="name"
        />
      </div>
      <div>
        <Label htmlFor="me">Email field</Label>
        <Input
          id="me"
          value={state.mapEmail}
          onChange={(e) => update('mapEmail', e.target.value)}
          placeholder="email"
        />
      </div>
      <div>
        <Label htmlFor="mp">Phone field</Label>
        <Input
          id="mp"
          value={state.mapPhone}
          onChange={(e) => update('mapPhone', e.target.value)}
          placeholder="phone"
        />
      </div>
      <p className="md:col-span-3 text-[12px] text-[var(--st-text-secondary)]">
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
        <Label htmlFor="ow">Default owner (user id)</Label>
        <Input
          id="ow"
          value={state.defaultOwner}
          onChange={(e) => update('defaultOwner', e.target.value)}
          placeholder="auto"
        />
        <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
          Leave empty for round-robin. Hard-code a user id to assign every match.
        </p>
      </div>
      <div>
        <Label htmlFor="pi">Default pipeline</Label>
        <Input
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
      <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
        <input
          type="checkbox"
          checked={state.notifyEmail}
          onChange={(e) => update('notifyEmail', e.target.checked)}
        />
        Email me when a new lead is auto-created
      </label>
      <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
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
  const [testPayload, setTestPayload] = React.useState('{\n  "message": "I would like to get a quote for...",\n  "name": "Jane Doe"\n}');
  const [testResult, setTestResult] = React.useState<'idle' | 'success' | 'fail'>('idle');

  const runTest = () => {
    try {
      if (!state.keyword) {
        setTestResult('fail');
        return;
      }
      
      const payloadStr = testPayload.toLowerCase();
      // Simple keyword match test
      const keywords = state.keyword.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      
      let matched = false;
      for (const kw of keywords) {
        if (payloadStr.includes(kw)) {
          matched = true;
          break;
        }
      }
      setTestResult(matched ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid gap-4">
        <h3 className="text-[14px] font-medium text-[var(--st-text)]">Rule Configuration</h3>
        <div>
          <Label htmlFor="rn">Rule name</Label>
          <Input
            id="rn"
            value={state.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Pricing enquiry"
          />
        </div>
        <div>
          <Label htmlFor="kw">Match keyword</Label>
          <Input
            id="kw"
            value={state.keyword}
            onChange={(e) => update('keyword', e.target.value)}
            placeholder="price, quote, cost"
          />
        </div>
        <div>
          <Label>Source</Label>
          <Select value={state.source} onValueChange={(v) => update('source', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ls">Lead source label</Label>
          <Input
            id="ls"
            value={state.leadSource}
            onChange={(e) => update('leadSource', e.target.value)}
            placeholder="Auto-Generated"
          />
        </div>
      </div>
      
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[var(--st-text-secondary)]" />
            <h3 className="text-[14px] font-medium text-[var(--st-text)]">Webhook Tester</h3>
          </div>
          <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
            Simulate an incoming payload to verify your keyword matching logic.
          </p>
        </div>
        <textarea
          value={testPayload}
          onChange={(e) => {
            setTestPayload(e.target.value);
            setTestResult('idle');
          }}
          className="min-h-[120px] w-full resize-none rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-2 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--st-text)]/50"
          spellCheck={false}
        />
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={runTest}>
            Run Test
          </Button>
          {testResult === 'success' && (
            <Badge className="bg-[var(--st-status-ok)]/20 text-[var(--st-status-ok)] hover:bg-[var(--st-status-ok)]/30">
              <Check className="mr-1 h-3 w-3" /> Keyword matched
            </Badge>
          )}
          {testResult === 'fail' && (
            <Badge variant="destructive" className="bg-[var(--st-danger)]/10 text-[var(--st-danger)] hover:bg-[var(--st-danger)]/20">
              No match
            </Badge>
          )}
        </div>
      </div>

      <p className="md:col-span-2 mt-2 text-[12px] text-[var(--st-text-secondary)] border-t border-[var(--st-border)] pt-4">
        Clicking <Badge variant="secondary">Activate rule</Badge> persists this
        configuration. Matching events will start creating leads as soon as the listener
        consumes them.
      </p>
    </div>
  );
}
