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
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building,
  Check,
  Coins,
  FileDigit,
  LoaderCircle,
  Sparkles,
  UsersRound,
  Wrench,
  } from 'lucide-react';

import { saveCrmIndustry } from '@/app/actions/crm.actions';

/**
 * CRM Setup Wizard — §1D multi-step onboarding for new tenants.
 *
 * 6 steps with progress bar:
 *   1. Company profile basics
 *   2. Industry / pipelines + stages
 *   3. Roles + first invites
 *   4. Numbering schemas (invoice/quote/PO)
 *   5. Tax + currency
 *   6. First lead + deal
 *
 * Only the industry step persists today (via saveCrmIndustry — preserved).
 * Other steps capture intent locally; persistence wires into the matching
 * settings actions as those screens land.
 */

import * as React from 'react';

const INDUSTRIES = [
  'Manufacturing',
  'Retail & eCommerce',
  'Services (IT, Consulting, Agencies)',
  'Construction & Real Estate',
  'Wholesale & Distribution',
  'Healthcare',
  'Education',
  'Logistics & Transport',
  'Accounting & Finance',
  'Food & Beverage',
  'Pharma & Life Sciences',
  'Nonprofits & NGOs',
  'Media & Creative Agencies',
  'Hospitality (Hotels, Resorts)',
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'];

interface WizardState {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  industry: string;
  pipelineName: string;
  stages: string;
  invites: string;
  invoicePrefix: string;
  quotePrefix: string;
  poPrefix: string;
  taxRate: string;
  currency: string;
  firstLeadTitle: string;
  firstDealTitle: string;
}

const STEPS = [
  { id: 0, label: 'Company', icon: Building },
  { id: 1, label: 'Industry & Pipeline', icon: Briefcase },
  { id: 2, label: 'Roles & Invites', icon: UsersRound },
  { id: 3, label: 'Numbering', icon: FileDigit },
  { id: 4, label: 'Tax & Currency', icon: Coins },
  { id: 5, label: 'First Records', icon: Sparkles },
] as const;

export default function CrmSetupPage(): React.JSX.Element {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [step, setStep] = React.useState(0);
  const [isPending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<WizardState>({
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    industry: '',
    pipelineName: 'Sales Pipeline',
    stages: 'New, Contacted, Qualified, Proposal, Won, Lost',
    invites: '',
    invoicePrefix: 'INV-',
    quotePrefix: 'QTE-',
    poPrefix: 'PO-',
    taxRate: '18',
    currency: 'INR',
    firstLeadTitle: '',
    firstDealTitle: '',
  });

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

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

  const handleFinish = React.useCallback(() => {
    if (!state.industry) {
      toast({ title: 'Please pick an industry', variant: 'destructive' });
      setStep(1);
      return;
    }
    startTransition(async () => {
      const res = await saveCrmIndustry(state.industry);
      if (res.success) {
        toast({
          title: 'CRM Setup Complete!',
          description: 'Tailored to your industry. Other defaults will save as you configure each module.',
        });
        router.push('/dashboard/crm');
        router.refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    });
  }, [router, state.industry, toast]);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
          <Wrench className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zoru-ink">
            Welcome to the CRM Suite
          </h1>
          <p className="mt-2 max-w-2xl text-[13.5px] text-zoru-ink-muted">
            Step {step + 1} of {totalSteps} — {STEPS[step].label}. Most defaults can be edited
            later from Settings.
          </p>
        </div>
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
                  done && !active && 'text-zoru-ink-muted',
                  !done && !active && 'text-zoru-ink-muted',
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
          <StepCompany state={state} update={update} />
        ) : step === 1 ? (
          <StepIndustry state={state} update={update} />
        ) : step === 2 ? (
          <StepInvites state={state} update={update} />
        ) : step === 3 ? (
          <StepNumbering state={state} update={update} />
        ) : step === 4 ? (
          <StepTax state={state} update={update} />
        ) : (
          <StepFirstRecords state={state} update={update} />
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
          <ZoruButton onClick={handleFinish} disabled={isPending}>
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Finish setup
          </ZoruButton>
        )}
      </div>
    </div>
  );
}

/* ─── Steps ───────────────────────────────────────────────────────────── */

function StepCompany({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel htmlFor="cn">Company name</ZoruLabel>
        <ZoruInput
          id="cn"
          value={state.companyName}
          onChange={(e) => update('companyName', e.target.value)}
          placeholder="Acme Corp"
        />
      </div>
      <div>
        <ZoruLabel htmlFor="ce">Company email</ZoruLabel>
        <ZoruInput
          id="ce"
          type="email"
          value={state.companyEmail}
          onChange={(e) => update('companyEmail', e.target.value)}
          placeholder="hello@acme.com"
        />
      </div>
      <div className="md:col-span-2">
        <ZoruLabel htmlFor="ca">Address</ZoruLabel>
        <ZoruTextarea
          id="ca"
          rows={3}
          value={state.companyAddress}
          onChange={(e) => update('companyAddress', e.target.value)}
          placeholder="Street, city, state, postal code"
        />
      </div>
    </div>
  );
}

function StepIndustry({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ZoruLabel>Industry</ZoruLabel>
        <p className="mb-2 text-[12px] text-zoru-ink-muted">
          Choose the closest match — we&rsquo;ll tailor stages, templates, and reports.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((i) => {
            const selected = state.industry === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => update('industry', i)}
                className={cn(
                  'rounded-xl border bg-zoru-bg p-3 text-left text-[12.5px]',
                  selected
                    ? 'border-zoru-primary ring-2 ring-zoru-primary/30'
                    : 'border-zoru-line hover:border-zoru-ink-muted',
                )}
              >
                {i}
                {selected ? (
                  <Check className="ml-2 inline h-3 w-3 text-zoru-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="pn">Default pipeline name</ZoruLabel>
          <ZoruInput
            id="pn"
            value={state.pipelineName}
            onChange={(e) => update('pipelineName', e.target.value)}
          />
        </div>
        <div>
          <ZoruLabel htmlFor="st">Stages (comma-separated)</ZoruLabel>
          <ZoruInput
            id="st"
            value={state.stages}
            onChange={(e) => update('stages', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function StepInvites({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ZoruLabel htmlFor="inv">Invite teammates</ZoruLabel>
        <ZoruTextarea
          id="inv"
          rows={4}
          value={state.invites}
          onChange={(e) => update('invites', e.target.value)}
          placeholder="One email per line. Default role: Sales User."
        />
      </div>
      <p className="text-[12px] text-zoru-ink-muted">
        Invites send after setup completes. You can refine roles in{' '}
        <ZoruBadge variant="secondary">Settings → Team</ZoruBadge>.
      </p>
    </div>
  );
}

function StepNumbering({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <ZoruLabel htmlFor="ip">Invoice prefix</ZoruLabel>
        <ZoruInput
          id="ip"
          value={state.invoicePrefix}
          onChange={(e) => update('invoicePrefix', e.target.value)}
        />
      </div>
      <div>
        <ZoruLabel htmlFor="qp">Quote prefix</ZoruLabel>
        <ZoruInput
          id="qp"
          value={state.quotePrefix}
          onChange={(e) => update('quotePrefix', e.target.value)}
        />
      </div>
      <div>
        <ZoruLabel htmlFor="pp">PO prefix</ZoruLabel>
        <ZoruInput
          id="pp"
          value={state.poPrefix}
          onChange={(e) => update('poPrefix', e.target.value)}
        />
      </div>
    </div>
  );
}

function StepTax({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel htmlFor="tx">Default tax rate (%)</ZoruLabel>
        <ZoruInput
          id="tx"
          type="number"
          min={0}
          max={100}
          value={state.taxRate}
          onChange={(e) => update('taxRate', e.target.value)}
        />
      </div>
      <div>
        <ZoruLabel>Default currency</ZoruLabel>
        <ZoruSelect
          value={state.currency}
          onValueChange={(v) => update('currency', v)}
        >
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {CURRENCIES.map((c) => (
              <ZoruSelectItem key={c} value={c}>
                {c}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
    </div>
  );
}

function StepFirstRecords({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel htmlFor="fl">First lead title (optional)</ZoruLabel>
        <ZoruInput
          id="fl"
          value={state.firstLeadTitle}
          onChange={(e) => update('firstLeadTitle', e.target.value)}
          placeholder="Acme website demo"
        />
      </div>
      <div>
        <ZoruLabel htmlFor="fd">First deal title (optional)</ZoruLabel>
        <ZoruInput
          id="fd"
          value={state.firstDealTitle}
          onChange={(e) => update('firstDealTitle', e.target.value)}
          placeholder="Acme — Q1 implementation"
        />
      </div>
      <p className="md:col-span-2 text-[12px] text-zoru-ink-muted">
        These will be created after setup completes (skip if you don&rsquo;t need example
        records). You can always create new ones from the All Leads / Deals lists.
      </p>
    </div>
  );
}
