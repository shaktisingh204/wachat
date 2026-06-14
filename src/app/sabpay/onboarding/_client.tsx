'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Landmark,
  FileCheck2,
  ShieldCheck,
  Loader2,
  Check,
  Upload,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

import { SabFilePickerButton } from '@/components/sabfiles';
import type { SabFilePick } from '@/components/sabfiles';
import {
  saveKycBusiness,
  saveKycBank,
  saveKycDocument,
  submitKyc,
} from '@/app/actions/sabpay-kyc.actions';
import { BUSINESS_TYPES, type SabpayKyc, type SabpayKycFileRef } from '@/lib/sabpay/kyc-shared';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual / freelancer',
  proprietorship: 'Sole proprietorship',
  partnership: 'Partnership',
  private_limited: 'Private limited company',
  llp: 'LLP',
  trust_society: 'Trust / society',
  other: 'Other',
};

const DOCS: Array<{ slot: keyof SabpayKyc; label: string; hint: string; required?: boolean }> = [
  { slot: 'docIdentity', label: 'Identity document', hint: 'PAN / passport / national ID', required: true },
  { slot: 'docBusinessProof', label: 'Business proof', hint: 'Registration / GST certificate' },
  { slot: 'docAddressProof', label: 'Address proof', hint: 'Utility bill / lease' },
  { slot: 'docBankProof', label: 'Bank proof', hint: 'Cancelled cheque / statement', required: true },
];

const STEPS = ['Business', 'Bank account', 'Documents', 'Review'];

const inputCls =
  'w-full rounded-[var(--st-radius,8px)] border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] px-3 py-2 text-sm text-[var(--st-text,#111)] outline-none focus:border-[var(--st-accent,#4f46e5)]';

export function OnboardingClient({ initial }: { initial: SabpayKyc | null }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [f, setF] = React.useState<SabpayKyc>({
    status: initial?.status ?? 'pending',
    legalName: initial?.legalName ?? '',
    businessType: initial?.businessType ?? 'individual',
    registrationNumber: initial?.registrationNumber ?? '',
    taxId: initial?.taxId ?? '',
    contactEmail: initial?.contactEmail ?? '',
    contactPhone: initial?.contactPhone ?? '',
    website: initial?.website ?? '',
    address1: initial?.address1 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postalCode: initial?.postalCode ?? '',
    country: initial?.country ?? '',
    bankAccountHolder: initial?.bankAccountHolder ?? '',
    bankAccountNumber: initial?.bankAccountNumber ?? '',
    bankIfsc: initial?.bankIfsc ?? '',
    docIdentity: initial?.docIdentity,
    docBusinessProof: initial?.docBusinessProof,
    docAddressProof: initial?.docAddressProof,
    docBankProof: initial?.docBankProof,
  });

  const set = (patch: Partial<SabpayKyc>) => setF((prev) => ({ ...prev, ...patch }));

  async function next() {
    setBusy(true);
    setError(null);
    try {
      if (step === 0) {
        const res = await saveKycBusiness({
          legalName: f.legalName,
          businessType: f.businessType,
          registrationNumber: f.registrationNumber,
          taxId: f.taxId,
          contactEmail: f.contactEmail,
          contactPhone: f.contactPhone,
          website: f.website,
          address1: f.address1,
          city: f.city,
          state: f.state,
          postalCode: f.postalCode,
          country: f.country,
        });
        if (!res.ok) return setError(res.error ?? 'Could not save.');
      } else if (step === 1) {
        const res = await saveKycBank({
          bankAccountHolder: f.bankAccountHolder,
          bankAccountNumber: f.bankAccountNumber,
          bankIfsc: f.bankIfsc,
        });
        if (!res.ok) return setError(res.error ?? 'Could not save.');
      }
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } finally {
      setBusy(false);
    }
  }

  async function pickDoc(slot: keyof SabpayKyc, pick: SabFilePick) {
    const ref: SabpayKycFileRef = { id: pick.id, url: pick.url, name: pick.name };
    set({ [slot]: ref } as Partial<SabpayKyc>);
    await saveKycDocument(slot, ref);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await submitKyc();
      if (!res.ok) {
        setError(res.error ?? 'Submission failed.');
        return;
      }
      router.replace('/sabpay');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--st-bg,#fafafa)] px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--st-accent,#4f46e5)]/10 text-[var(--st-accent,#4f46e5)]">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[var(--st-text,#111)]">
              Activate your SabPay account
            </h1>
            <p className="text-sm text-[var(--st-text-secondary,#666)]">
              Complete onboarding to start accepting payments. Your details are
              used for compliance and settlements.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <ol className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => {
            const Icon = [Building2, Landmark, FileCheck2, ShieldCheck][i];
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'bg-[var(--st-accent,#4f46e5)] text-white'
                        : 'bg-[var(--st-border,#eee)] text-[var(--st-text-tertiary,#999)]'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={`hidden text-xs sm:block ${
                    active ? 'font-medium text-[var(--st-text,#111)]' : 'text-[var(--st-text-tertiary,#999)]'
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 ? (
                  <span className="h-px flex-1 bg-[var(--st-border,#eee)]" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] p-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {step === 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Legal business name *" className="sm:col-span-2">
                <input className={inputCls} value={f.legalName} onChange={(e) => set({ legalName: e.target.value })} />
              </Field>
              <Field label="Business type *">
                <select className={inputCls} value={f.businessType} onChange={(e) => set({ businessType: e.target.value })}>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BUSINESS_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Registration / GST no.">
                <input className={inputCls} value={f.registrationNumber} onChange={(e) => set({ registrationNumber: e.target.value })} />
              </Field>
              <Field label="Tax ID (PAN/EIN)">
                <input className={inputCls} value={f.taxId} onChange={(e) => set({ taxId: e.target.value })} />
              </Field>
              <Field label="Website">
                <input className={inputCls} value={f.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
              </Field>
              <Field label="Contact email *">
                <input className={inputCls} type="email" value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
              </Field>
              <Field label="Contact phone">
                <input className={inputCls} value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
              </Field>
              <Field label="Address *" className="sm:col-span-2">
                <input className={inputCls} value={f.address1} onChange={(e) => set({ address1: e.target.value })} />
              </Field>
              <Field label="City">
                <input className={inputCls} value={f.city} onChange={(e) => set({ city: e.target.value })} />
              </Field>
              <Field label="State / region">
                <input className={inputCls} value={f.state} onChange={(e) => set({ state: e.target.value })} />
              </Field>
              <Field label="Postal code">
                <input className={inputCls} value={f.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
              </Field>
              <Field label="Country *">
                <input className={inputCls} value={f.country} onChange={(e) => set({ country: e.target.value })} placeholder="IN / US / …" />
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid grid-cols-1 gap-3">
              <p className="text-sm text-[var(--st-text-secondary,#666)]">
                Settlements are paid out to this account.
              </p>
              <Field label="Account holder name *">
                <input className={inputCls} value={f.bankAccountHolder} onChange={(e) => set({ bankAccountHolder: e.target.value })} />
              </Field>
              <Field label="Account number *">
                <input className={inputCls} value={f.bankAccountNumber} onChange={(e) => set({ bankAccountNumber: e.target.value })} />
              </Field>
              <Field label="IFSC / routing number *">
                <input className={inputCls} value={f.bankIfsc} onChange={(e) => set({ bankIfsc: e.target.value })} />
              </Field>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--st-text-secondary,#666)]">
                Upload your KYC documents from SabFiles. PDF or image.
              </p>
              {DOCS.map(({ slot, label, hint, required }) => {
                const ref = f[slot] as SabpayKycFileRef | undefined;
                return (
                  <div
                    key={slot}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--st-border,#e5e5e5)] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--st-text,#111)]">
                        {label} {required ? <span className="text-red-500">*</span> : null}
                      </div>
                      <div className="truncate text-xs text-[var(--st-text-tertiary,#999)]">
                        {ref?.name ? ref.name : hint}
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {ref?.id ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Upload className="h-4 w-4 text-[var(--st-text-tertiary,#999)]" />
                      )}
                      <SabFilePickerButton onPick={(p: SabFilePick) => pickDoc(slot, p)}>
                        {ref?.id ? 'Replace' : 'Upload'}
                      </SabFilePickerButton>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-[var(--st-text,#111)]">Review &amp; submit</h3>
              <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                <Review k="Business" v={f.legalName} />
                <Review k="Type" v={BUSINESS_TYPE_LABELS[f.businessType ?? ''] ?? f.businessType} />
                <Review k="Email" v={f.contactEmail} />
                <Review k="Country" v={f.country} />
                <Review k="Bank holder" v={f.bankAccountHolder} />
                <Review k="Account" v={f.bankAccountNumber ? `••••${f.bankAccountNumber.slice(-4)}` : ''} />
                <Review k="Identity doc" v={f.docIdentity?.name || (f.docIdentity?.id ? 'Uploaded' : '—')} />
                <Review k="Bank proof" v={f.docBankProof?.name || (f.docBankProof?.id ? 'Uploaded' : '—')} />
              </dl>
              <p className="text-xs text-[var(--st-text-tertiary,#999)]">
                By submitting you confirm the information is accurate. Your account
                is activated once verified.
              </p>
            </div>
          ) : null}

          {/* Nav */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={busy || step === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--st-text-secondary,#666)] disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--st-accent,#4f46e5)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Submit for activation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-xs font-medium text-[var(--st-text-secondary,#666)]">{label}</span>
      {children}
    </label>
  );
}

function Review({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--st-border,#f0f0f0)] py-1">
      <dt className="text-[var(--st-text-tertiary,#999)]">{k}</dt>
      <dd className="truncate text-right text-[var(--st-text,#111)]">{v || '—'}</dd>
    </div>
  );
}
