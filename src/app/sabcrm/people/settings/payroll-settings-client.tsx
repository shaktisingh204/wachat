'use client';

/**
 * SabCRM People — Payroll settings client
 * (`/sabcrm/people/settings`, WI-35).
 *
 * Single-card form over the WI-14 singleton: companyName (stamped onto
 * generated payslip headers), PF / ESI employee rates, pay cycle,
 * default currency, the progressive tax-slab repeater ({min, max,
 * rate}) and the lifecycle status. Save upserts the project's one
 * settings document; the form re-seeds from the saved response.
 */

import * as React from 'react';
import { Plus, Save, Settings, X } from 'lucide-react';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  PAY_CYCLES,
  PAYROLL_SETTING_STATUSES,
  type CrmPayrollSettingDoc,
  type CrmPayrollSettingPayCycle,
  type CrmPayrollSettingStatus,
  type SabcrmPayrollSettingsInput,
} from '@/app/actions/sabcrm-people-payroll-settings.actions.types';
import { saveSabcrmPayrollSettings } from '@/app/actions/sabcrm-people-payroll-settings.actions';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../../finance/_components/doc-surface/doc-surface.css';

/* ─── Form state ──────────────────────────────────────────────── */

interface SlabDraft {
  rowId: string;
  min: string;
  max: string;
  rate: string;
}

let slabSeq = 0;
const nextSlabId = (): string => `slab-${++slabSeq}`;

interface SettingsForm {
  companyName: string;
  pfRate: string;
  esiRate: string;
  payCycle: CrmPayrollSettingPayCycle;
  defaultCurrency: string;
  taxSlabs: SlabDraft[];
  status: CrmPayrollSettingStatus;
}

function fromDoc(doc: CrmPayrollSettingDoc | null): SettingsForm {
  return {
    companyName: doc?.companyName ?? '',
    pfRate: doc?.pfRate != null ? String(doc.pfRate) : '',
    esiRate: doc?.esiRate != null ? String(doc.esiRate) : '',
    payCycle: doc?.payCycle ?? 'monthly',
    defaultCurrency: doc?.defaultCurrency ?? 'INR',
    taxSlabs: (doc?.taxSlabs ?? []).map((s) => ({
      rowId: nextSlabId(),
      min: s.min != null ? String(s.min) : '',
      max: s.max != null ? String(s.max) : '',
      rate: s.rate != null ? String(s.rate) : '',
    })),
    status: doc?.status ?? 'active',
  };
}

const CYCLE_OPTIONS: SelectOption[] = PAY_CYCLES.map((c) => ({
  value: c.value,
  label: c.label,
}));

const STATUS_OPTIONS: SelectOption[] = PAYROLL_SETTING_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

function numOrUndefined(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/* ─── Component ───────────────────────────────────────────────── */

export interface PayrollSettingsClientProps {
  initial: CrmPayrollSettingDoc | null;
  initialError: string | null;
}

export function PayrollSettingsClient({
  initial,
  initialError,
}: PayrollSettingsClientProps): React.JSX.Element {
  const [form, setForm] = React.useState<SettingsForm>(() => fromDoc(initial));
  const [savedAt, setSavedAt] = React.useState<string | null>(
    initial?.updatedAt ?? null,
  );
  const [error, setError] = React.useState<string | null>(initialError);
  const [pending, startTransition] = React.useTransition();

  const patch = (p: Partial<SettingsForm>): void =>
    setForm((prev) => ({ ...prev, ...p }));

  const patchSlab = (rowId: string, p: Partial<SlabDraft>): void =>
    patch({
      taxSlabs: form.taxSlabs.map((s) =>
        s.rowId === rowId ? { ...s, ...p } : s,
      ),
    });

  const submit = (): void => {
    setError(null);
    const input: SabcrmPayrollSettingsInput = {
      companyName: form.companyName || undefined,
      pfRate: numOrUndefined(form.pfRate),
      esiRate: numOrUndefined(form.esiRate),
      payCycle: form.payCycle,
      defaultCurrency: form.defaultCurrency || undefined,
      taxSlabs: form.taxSlabs.map((s) => ({
        min: numOrUndefined(s.min),
        max: numOrUndefined(s.max),
        rate: numOrUndefined(s.rate),
      })),
      status: form.status,
    };
    startTransition(async () => {
      const res = await saveSabcrmPayrollSettings(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success('Payroll settings saved.');
      setForm(fromDoc(res.data));
      setSavedAt(res.data.updatedAt ?? new Date().toISOString());
    });
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              <Settings size={18} aria-hidden="true" /> People settings
            </span>
          </PageTitle>
          <PageDescription>
            Project-wide payroll configuration — company identity on generated
            payslips, statutory rates, pay cycle and the income-tax slabs the
            engine applies.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Save}
            loading={pending}
            onClick={submit}
          >
            Save settings
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <div className="mb-4">
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Payroll configuration</CardTitle>
            <CardDescription>
              {savedAt
                ? `Last saved ${new Date(savedAt).toLocaleString('en-IN')}.`
                : 'Not configured yet — saving creates this project’s settings document.'}
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="fdoc-form-grid">
              <Field
                label="Company name"
                help="Printed in the header of every generated payslip."
              >
                <Input
                  value={form.companyName}
                  onChange={(e) => patch({ companyName: e.target.value })}
                  placeholder="SabNode Technologies Pvt Ltd"
                  disabled={pending}
                />
              </Field>
              <Field label="Default currency">
                <Input
                  value={form.defaultCurrency}
                  onChange={(e) =>
                    patch({ defaultCurrency: e.target.value.toUpperCase() })
                  }
                  placeholder="INR"
                  maxLength={3}
                  disabled={pending}
                />
              </Field>
              <Field label="Pay cycle">
                <SelectField
                  value={form.payCycle}
                  onChange={(v) =>
                    patch({
                      payCycle: (v || 'monthly') as CrmPayrollSettingPayCycle,
                    })
                  }
                  options={CYCLE_OPTIONS}
                  disabled={pending}
                  aria-label="Pay cycle"
                />
              </Field>
              <Field label="Status" help="Archived settings stop new runs from using them.">
                <SelectField
                  value={form.status}
                  onChange={(v) =>
                    patch({
                      status: (v || 'active') as CrmPayrollSettingStatus,
                    })
                  }
                  options={STATUS_OPTIONS}
                  disabled={pending}
                  aria-label="Status"
                />
              </Field>
              <Field label="PF rate (%)" help="Employee provident-fund deduction rate.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.pfRate}
                  onChange={(e) => patch({ pfRate: e.target.value })}
                  placeholder="12"
                  disabled={pending}
                />
              </Field>
              <Field label="ESI rate (%)" help="Employee state-insurance deduction rate.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.esiRate}
                  onChange={(e) => patch({ esiRate: e.target.value })}
                  placeholder="0.75"
                  disabled={pending}
                />
              </Field>
            </div>

            <h3 className="mb-1 mt-5 text-sm font-semibold">Income-tax slabs</h3>
            <p className="m-0 mb-3 text-xs text-[var(--st-text-secondary)]">
              Progressive annual slabs — leave the maximum blank on the top
              slab. Blank rows are ignored.
            </p>
            <div className="flex flex-col gap-2">
              {form.taxSlabs.map((slab, i) => (
                <div
                  key={slab.rowId}
                  className="grid grid-cols-[1fr_1fr_120px_auto] items-end gap-2"
                >
                  <Field label={i === 0 ? 'From (₹)' : undefined}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={slab.min}
                      onChange={(e) => patchSlab(slab.rowId, { min: e.target.value })}
                      placeholder="0"
                      disabled={pending}
                      aria-label={`Slab ${i + 1} minimum`}
                    />
                  </Field>
                  <Field label={i === 0 ? 'Up to (₹)' : undefined}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={slab.max}
                      onChange={(e) => patchSlab(slab.rowId, { max: e.target.value })}
                      placeholder="No ceiling"
                      disabled={pending}
                      aria-label={`Slab ${i + 1} maximum`}
                    />
                  </Field>
                  <Field label={i === 0 ? 'Rate (%)' : undefined}>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      value={slab.rate}
                      onChange={(e) => patchSlab(slab.rowId, { rate: e.target.value })}
                      placeholder="5"
                      disabled={pending}
                      aria-label={`Slab ${i + 1} rate`}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconLeft={X}
                    disabled={pending}
                    aria-label={`Remove slab ${i + 1}`}
                    onClick={() =>
                      patch({
                        taxSlabs: form.taxSlabs.filter(
                          (s) => s.rowId !== slab.rowId,
                        ),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={Plus}
                disabled={pending}
                onClick={() =>
                  patch({
                    taxSlabs: [
                      ...form.taxSlabs,
                      { rowId: nextSlabId(), min: '', max: '', rate: '' },
                    ],
                  })
                }
              >
                Add slab
              </Button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
                Save settings
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
