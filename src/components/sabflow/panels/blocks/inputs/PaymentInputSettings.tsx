'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Info, User } from 'lucide-react';
import type {
  Block,
  Variable,
  PaymentInputOptions,
  PaymentProvider,
} from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Switch,
  Separator,
  Callout,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';
import { VariableSelect } from '../shared/VariableSelect';

/* -- Option tables --------------------------------------------------------- */

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'paypal', label: 'PayPal' },
];

const CURRENCIES: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD, US Dollar' },
  { value: 'EUR', label: 'EUR, Euro' },
  { value: 'GBP', label: 'GBP, British Pound' },
  { value: 'INR', label: 'INR, Indian Rupee' },
  { value: 'CAD', label: 'CAD, Canadian Dollar' },
  { value: 'AUD', label: 'AUD, Australian Dollar' },
  { value: 'JPY', label: 'JPY, Japanese Yen' },
  { value: 'SGD', label: 'SGD, Singapore Dollar' },
  { value: 'AED', label: 'AED, UAE Dirham' },
  { value: 'BRL', label: 'BRL, Brazilian Real' },
  { value: 'CHF', label: 'CHF, Swiss Franc' },
  { value: 'MXN', label: 'MXN, Mexican Peso' },
];

/* -- Shape for masked credentials returned by the API ---------------------- */

interface MaskedCredentialSummary {
  id: string;
  name: string;
  type: string;
}

interface CredentialsResponse {
  credentials?: MaskedCredentialSummary[];
}

/* -- Local UI helpers ------------------------------------------------------ */

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
      <span className="select-none text-[12px] text-[var(--st-text-secondary)]">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
      {children}
    </span>
  );
}

/* -- Props ----------------------------------------------------------------- */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* -- Main component -------------------------------------------------------- */

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

  /* -- State ------------------------------------------------------------- */
  const [credentials, setCredentials] = useState<MaskedCredentialSummary[]>([]);
  const [credsLoading, setCredsLoading] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [secretFallback, setSecretFallback] = useState(false);

  /* -- Update helper ----------------------------------------------------- */
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

  /* -- Load credentials when provider changes ---------------------------- */
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
          // Probably no session / CredentialSelect not available, fall back.
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

  /* -- Render ------------------------------------------------------------ */
  return (
    <div className="space-y-4">
      {/* -- Header ------------------------------------------------ */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
          <CreditCard className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
          Payment
        </span>
      </div>

      {/* -- Provider -------------------------------------------- */}
      <Field label="Provider">
        <Select
          value={provider}
          onValueChange={(value) => update({ provider: value as PaymentProvider })}
        >
          <SelectTrigger aria-label="Payment provider">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* -- Credential ------------------------------------------ */}
      {secretFallback ? (
        <Field
          label="Credential"
          help="Could not load stored credentials. Paste the provider secret key directly (stored with the flow)."
        >
          <Input
            type="password"
            value={credentialId ?? ''}
            onChange={(e) => update({ credentialId: e.target.value })}
            placeholder={isStripe ? 'sk_test_...' : 'secret key'}
            autoComplete="off"
          />
        </Field>
      ) : (
        <Field
          label="Credential"
          error={credsError ?? undefined}
          help={
            !credsLoading && credentials.length === 0 && !credsError
              ? `No ${provider} credentials yet. Create one in Settings, Credentials.`
              : undefined
          }
        >
          <Select
            value={credentialId ?? ''}
            onValueChange={(value) => update({ credentialId: value || undefined })}
            disabled={credsLoading}
          >
            <SelectTrigger aria-label="Stored credential">
              <SelectValue placeholder={credsLoading ? 'Loading...' : 'Select a credential'} />
            </SelectTrigger>
            <SelectContent>
              {credentials.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <Separator />

      {/* -- Amount + Currency ----------------------------------- */}
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Amount">
          <Input
            type="text"
            value={amount}
            onChange={(e) => update({ amount: e.target.value })}
            placeholder="9.99 or {{amount}}"
            inputMode="decimal"
          />
        </Field>

        <Field label="Currency">
          <Select value={currency} onValueChange={(value) => update({ currency: value })}>
            <SelectTrigger aria-label="Currency">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Callout tone="info" icon={Info}>
        Decimal amounts are converted to the smallest currency unit server-side.
      </Callout>

      {/* -- Description ----------------------------------------- */}
      <Field label="Description">
        <Input
          type="text"
          value={description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Order #{{orderId}}"
        />
      </Field>

      <Separator />

      {/* -- Labels ---------------------------------------------- */}
      <Field label="Button text">
        <Input
          type="text"
          value={buttonLabel}
          onChange={(e) => updateLabels({ button: e.target.value })}
          placeholder="Pay {{amount}}"
        />
      </Field>

      <Field label="Success message">
        <Input
          type="text"
          value={successLabel}
          onChange={(e) => updateLabels({ success: e.target.value })}
          placeholder="Payment successful!"
        />
      </Field>

      <Field label="Save result to variable">
        <VariableSelect
          variables={variables}
          value={opts.variableId}
          onChange={(id) => update({ variableId: id })}
          placeholder="optional"
        />
      </Field>

      <Separator />

      {/* -- Collect customer info (collapsible) ----------------- */}
      <Collapsible className="space-y-3">
        <CollapsibleTrigger className="w-full" hideChevron={false}>
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" strokeWidth={1.8} aria-hidden="true" />
            <SectionHeading>Collect customer info</SectionHeading>
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
            <ToggleRow
              label="Full name"
              checked={Boolean(info.name)}
              onChange={(next) => updateInfo({ name: next ? (info.name || 'Full name') : undefined })}
            />
            <ToggleRow
              label="Email"
              checked={Boolean(info.email)}
              onChange={(next) => updateInfo({ email: next ? (info.email || 'Email') : undefined })}
            />
            <ToggleRow
              label="Phone number"
              checked={Boolean(info.phoneNumber)}
              onChange={(next) =>
                updateInfo({ phoneNumber: next ? (info.phoneNumber || 'Phone') : undefined })
              }
            />

            <Separator />

            {/* Address collapsible */}
            <Collapsible className="space-y-3">
              <CollapsibleTrigger className="w-full">
                <SectionHeading>Billing address</SectionHeading>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="grid grid-cols-1 gap-2">
                  <Field label="Country">
                    <Input
                      type="text"
                      value={addr.country ?? ''}
                      onChange={(e) => updateAddress({ country: e.target.value || undefined })}
                      placeholder="Country"
                    />
                  </Field>
                  <Field label="Address line 1">
                    <Input
                      type="text"
                      value={addr.line1 ?? ''}
                      onChange={(e) => updateAddress({ line1: e.target.value || undefined })}
                      placeholder="Address line 1"
                    />
                  </Field>
                  <Field label="Address line 2">
                    <Input
                      type="text"
                      value={addr.line2 ?? ''}
                      onChange={(e) => updateAddress({ line2: e.target.value || undefined })}
                      placeholder="Address line 2"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="City">
                      <Input
                        type="text"
                        value={addr.city ?? ''}
                        onChange={(e) => updateAddress({ city: e.target.value || undefined })}
                        placeholder="City"
                      />
                    </Field>
                    <Field label="State">
                      <Input
                        type="text"
                        value={addr.state ?? ''}
                        onChange={(e) => updateAddress({ state: e.target.value || undefined })}
                        placeholder="State"
                      />
                    </Field>
                  </div>
                  <Field label="Postal code">
                    <Input
                      type="text"
                      value={addr.postalCode ?? ''}
                      onChange={(e) => updateAddress({ postalCode: e.target.value || undefined })}
                      placeholder="Postal code"
                    />
                  </Field>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
