'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LuCreditCard,
  LuChevronDown,
  LuInfo,
  LuUser,
} from 'react-icons/lu';
import type {
  Block,
  Variable,
  PaymentInputOptions,
  PaymentProvider,
} from '@/lib/sabflow/types';
import {
  Field,
  PanelHeader,
  inputClass,
  selectClass,
  Divider,
  toggleClass,
} from '../shared/primitives';
import { VariableSelect } from '../shared/VariableSelect';

/* ── Option tables ──────────────────────────────────────────────────────── */

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'paypal', label: 'PayPal' },
];

const CURRENCIES: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'CHF', label: 'CHF — Swiss Franc' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
];

/* ── Shape for masked credentials returned by the API ───────────────────── */

interface MaskedCredentialSummary {
  id: string;
  name: string;
  type: string;
}

interface CredentialsResponse {
  credentials?: MaskedCredentialSummary[];
}

/* ── Local UI helpers ───────────────────────────────────────────────────── */

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-[var(--gray-11)] select-none">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={toggleClass(checked)}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-[var(--gray-9)] uppercase tracking-wider">
      {children}
    </span>
  );
}

/* ── Props ──────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ─────────────────────────────────────────────────────── */

export function PaymentInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as PaymentInputOptions;

  const provider: PaymentProvider = opts.provider ?? 'stripe';
  const currency = opts.currency ?? 'USD';
  const amount = opts.amount ?? '';
  const description = opts.description ?? '';
  const credentialId = opts.credentialId;
  const buttonLabel = opts.labels?.button ?? 'Pay {{amount}}';
  const successLabel = opts.labels?.success ?? 'Payment successful!';
  const info = opts.additionalInformation ?? {};
  const addr = info.address ?? {};

  /* ── State ───────────────────────────────────────────────────────────── */
  const [credentials, setCredentials] = useState<MaskedCredentialSummary[]>([]);
  const [credsLoading, setCredsLoading] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [secretFallback, setSecretFallback] = useState(false);

  /* ── Update helper ───────────────────────────────────────────────────── */
  const update = useCallback(
    (patch: Partial<PaymentInputOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const updateLabels = useCallback(
    (patch: Partial<NonNullable<PaymentInputOptions['labels']>>) => {
      update({ labels: { ...(opts.labels ?? {}), ...patch } });
    },
    [opts.labels, update],
  );

  const updateInfo = useCallback(
    (patch: Partial<NonNullable<PaymentInputOptions['additionalInformation']>>) => {
      update({ additionalInformation: { ...info, ...patch } });
    },
    [info, update],
  );

  const updateAddress = useCallback(
    (patch: Partial<NonNullable<NonNullable<PaymentInputOptions['additionalInformation']>['address']>>) => {
      updateInfo({ address: { ...addr, ...patch } });
    },
    [addr, updateInfo],
  );

  /* ── Load credentials when provider changes ──────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function fetchCreds() {
      setCredsLoading(true);
      setCredsError(null);
      try {
        const res = await fetch(`/api/sabflow/credentials?type=${provider}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          // Probably no session / CredentialSelect not available — fall back.
          setSecretFallback(true);
          setCredentials([]);
          return;
        }
        const json = (await res.json()) as CredentialsResponse;
        if (!cancelled) {
          setCredentials(json.credentials ?? []);
          setSecretFallback(false);
        }
      } catch (err) {
        if (!cancelled) {
          setCredsError(err instanceof Error ? err.message : 'Failed to load credentials');
          setSecretFallback(true);
        }
      } finally {
        if (!cancelled) setCredsLoading(false);
      }
    }
    void fetchCreds();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const isStripe = provider === 'stripe';

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <PanelHeader icon={LuCreditCard} title="Payment" />

      {/* ── Provider ────────────────────────────────────────── */}
      <Field label="Provider">
        <select
          value={provider}
          onChange={(e) => update({ provider: e.target.value as PaymentProvider })}
          className={selectClass}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      {/* ── Credential ──────────────────────────────────────── */}
      <Field label="Credential">
        {secretFallback ? (
          <>
            <input
              type="password"
              value={credentialId ?? ''}
              onChange={(e) => update({ credentialId: e.target.value })}
              placeholder={isStripe ? 'sk_test_…' : 'secret key'}
              className={inputClass}
              autoComplete="off"
            />
            <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">
              Couldn&apos;t load stored credentials. Paste the provider secret key directly (stored with the flow).
            </p>
          </>
        ) : (
          <>
            <select
              value={credentialId ?? ''}
              onChange={(e) => update({ credentialId: e.target.value || undefined })}
              className={selectClass}
              disabled={credsLoading}
            >
              <option value="">
                {credsLoading ? 'Loading…' : '— select a credential —'}
              </option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {credsError && (
              <p className="mt-1 text-[10.5px] text-red-400">{credsError}</p>
            )}
            {!credsLoading && credentials.length === 0 && !credsError && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">
                No {provider} credentials yet — create one in Settings → Credentials.
              </p>
            )}
          </>
        )}
      </Field>

      <Divider />

      {/* ── Amount + Currency ───────────────────────────────── */}
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Amount">
          <input
            type="text"
            value={amount}
            onChange={(e) => update({ amount: e.target.value })}
            placeholder="9.99 or {{amount}}"
            className={inputClass}
            inputMode="decimal"
          />
        </Field>

        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => update({ currency: e.target.value })}
            className={selectClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="-mt-1 flex items-center gap-1 text-[10.5px] text-[var(--gray-8)]">
        <LuInfo className="h-3 w-3" strokeWidth={2} />
        Decimal amounts are converted to the smallest currency unit server-side.
      </p>

      {/* ── Description ─────────────────────────────────────── */}
      <Field label="Description">
        <input
          type="text"
          value={description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Order #{{orderId}}"
          className={inputClass}
        />
      </Field>

      <Divider />

      {/* ── Labels ─────────────────────────────────────────── */}
      <Field label="Button text">
        <input
          type="text"
          value={buttonLabel}
          onChange={(e) => updateLabels({ button: e.target.value })}
          placeholder="Pay {{amount}}"
          className={inputClass}
        />
      </Field>

      <Field label="Success message">
        <input
          type="text"
          value={successLabel}
          onChange={(e) => updateLabels({ success: e.target.value })}
          placeholder="Payment successful!"
          className={inputClass}
        />
      </Field>

      <Field label="Save result to variable">
        <VariableSelect
          variables={variables}
          value={opts.variableId}
          onChange={(id) => update({ variableId: id })}
          placeholder="— optional —"
        />
      </Field>

      <Divider />

      {/* ── Collect customer info (collapsible) ─────────────── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCustomerOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-1.5">
            <LuUser className="h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={1.8} />
            <SectionHeading>Collect customer info</SectionHeading>
          </div>
          <LuChevronDown
            className={`h-3.5 w-3.5 text-[var(--gray-9)] transition-transform duration-200 ${
              customerOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </button>

        {customerOpen && (
          <div className="space-y-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3">
            <ToggleRow
              label="Full name"
              checked={Boolean(info.name)}
              onChange={(next) => updateInfo({ name: next ? (info.name || 'Full name') : undefined })}
            />
            <ToggleRow
              label="Email"
              checked={Boolean(info.email)}
              onChange={(next) =>
                updateInfo({ email: next ? (info.email || 'Email') : undefined })
              }
            />
            <ToggleRow
              label="Phone number"
              checked={Boolean(info.phoneNumber)}
              onChange={(next) =>
                updateInfo({ phoneNumber: next ? (info.phoneNumber || 'Phone') : undefined })
              }
            />

            <Divider />

            {/* Address collapsible */}
            <button
              type="button"
              onClick={() => setAddressOpen((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <SectionHeading>Billing address</SectionHeading>
              <LuChevronDown
                className={`h-3.5 w-3.5 text-[var(--gray-9)] transition-transform duration-200 ${
                  addressOpen ? 'rotate-180' : ''
                }`}
                strokeWidth={2}
              />
            </button>

            {addressOpen && (
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={addr.country ?? ''}
                  onChange={(e) => updateAddress({ country: e.target.value || undefined })}
                  placeholder="Country"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={addr.line1 ?? ''}
                  onChange={(e) => updateAddress({ line1: e.target.value || undefined })}
                  placeholder="Address line 1"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={addr.line2 ?? ''}
                  onChange={(e) => updateAddress({ line2: e.target.value || undefined })}
                  placeholder="Address line 2"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={addr.city ?? ''}
                    onChange={(e) => updateAddress({ city: e.target.value || undefined })}
                    placeholder="City"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={addr.state ?? ''}
                    onChange={(e) => updateAddress({ state: e.target.value || undefined })}
                    placeholder="State"
                    className={inputClass}
                  />
                </div>
                <input
                  type="text"
                  value={addr.postalCode ?? ''}
                  onChange={(e) => updateAddress({ postalCode: e.target.value || undefined })}
                  placeholder="Postal code"
                  className={inputClass}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
