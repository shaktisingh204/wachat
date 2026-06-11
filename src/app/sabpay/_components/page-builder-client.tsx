'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  SegmentedControl,
  SelectField,
  Switch,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  formatSabpayAmount,
  type SabpayMode,
  type SabpayPaymentPage,
  type SabpayPaymentPageField,
} from '@/lib/sabpay/types';

import {
  checkSabpaySlugAvailable,
  createSabpayPaymentPage,
  updateSabpayPaymentPage,
} from '../actions/payment-pages';

type AmountType = 'fixed' | 'customer_decided';

const AMOUNT_TYPES: Array<{ value: AmountType; label: string }> = [
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'customer_decided', label: 'Customer decides' },
];

const FIELD_TYPE_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
];

const FIELD_PLACEHOLDER: Record<string, string> = {
  text: 'Your answer',
  email: 'name@example.com',
  phone: '+91 98765 43210',
  number: '0',
};

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

interface BuilderFieldRow {
  localId: string;
  /** Preserved key from an existing page; new rows get one generated on save. */
  key?: string;
  label: string;
  type: string;
  required: boolean;
}

let rowSeq = 0;
function newRowId(): string {
  rowSeq += 1;
  return `pbf-${rowSeq}`;
}

/** Rupee string from the form → integer paise, or null when not a valid amount. */
function toPaise(rupees: string): number | null {
  const n = Number.parseFloat(rupees);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** "Full name" → "full_name"; falls back to a positional key. */
function buildFields(rows: BuilderFieldRow[]): SabpayPaymentPageField[] {
  const used = new Set<string>();
  return rows.map((row, i) => {
    const base =
      row.key ||
      row.label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `field_${i + 1}`;
    let key = base;
    let n = 2;
    while (used.has(key)) key = `${base}_${n++}`;
    used.add(key);
    return { key, label: row.label.trim(), type: row.type, required: row.required };
  });
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--st-font-mono, monospace)',
  fontSize: 12.5,
};

export interface PageBuilderClientProps {
  /** Pass the existing page to switch the builder into edit mode. */
  initial?: SabpayPaymentPage;
  mode: SabpayMode;
}

export function PageBuilderClient({ initial, mode }: PageBuilderClientProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [amountType, setAmountType] = React.useState<AmountType>(
    initial?.amountType === 'customer_decided' ? 'customer_decided' : 'fixed',
  );
  const [amount, setAmount] = React.useState(
    initial?.amount != null ? String(initial.amount / 100) : '',
  );
  const [minAmount, setMinAmount] = React.useState(
    initial?.minAmount != null ? String(initial.minAmount / 100) : '',
  );
  const [brandingImageUrl, setBrandingImageUrl] = React.useState(
    initial?.brandingImageUrl ?? '',
  );
  const [fields, setFields] = React.useState<BuilderFieldRow[]>(() =>
    (initial?.fields ?? []).map((f) => ({
      localId: newRowId(),
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
    })),
  );

  const [slugStatus, setSlugStatus] = React.useState<SlugStatus>('idle');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // The dashboard origin for the live `${origin}/pay/<slug>` preview —
  // read after mount so SSR and hydration agree.
  const [origin, setOrigin] = React.useState('');
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Debounced live availability check (create mode only — slugs are immutable).
  React.useEffect(() => {
    if (isEdit) return;
    const value = slug.trim();
    if (!value) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      checkSabpaySlugAvailable(value)
        .then((available) => {
          if (!cancelled) setSlugStatus(available ? 'available' : 'taken');
        })
        .catch(() => {
          if (!cancelled) setSlugStatus('idle');
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, isEdit]);

  const previewUrl = `${origin}/pay/${slug || 'your-page'}`;
  const fixedPaise = toPaise(amount);
  const minPaise = toPaise(minAmount);

  function updateField(localId: string, patch: Partial<BuilderFieldRow>) {
    setFields((prev) =>
      prev.map((f) => (f.localId === localId ? { ...f, ...patch } : f)),
    );
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { localId: newRowId(), label: '', type: 'text', required: false },
    ]);
  }

  function removeField(localId: string) {
    setFields((prev) => prev.filter((f) => f.localId !== localId));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const t = title.trim();
    if (!t) {
      setFormError('Give the page a title.');
      return;
    }
    if (!isEdit) {
      if (!slug.trim()) {
        setFormError('Choose a slug for the page URL.');
        return;
      }
      if (slugStatus === 'taken') {
        setFormError('That slug is already taken — pick another.');
        return;
      }
    }
    if (amountType === 'fixed' && (fixedPaise == null || fixedPaise < 100)) {
      setFormError('Enter a fixed amount of at least ₹1.');
      return;
    }
    if (amountType === 'customer_decided' && minAmount.trim() && minPaise == null) {
      setFormError('Enter a valid minimum amount, or leave it empty.');
      return;
    }
    if (fields.some((f) => !f.label.trim())) {
      setFormError('Every custom field needs a label.');
      return;
    }

    const builtFields = buildFields(fields);
    const sharedAmounts = {
      amount: amountType === 'fixed' ? fixedPaise ?? undefined : undefined,
      minAmount:
        amountType === 'customer_decided' ? minPaise ?? undefined : undefined,
    };

    setSaving(true);
    const result = initial
      ? await updateSabpayPaymentPage(initial.id, {
          title: t,
          description: description.trim() || undefined,
          ...sharedAmounts,
          fields: builtFields,
          brandingImageUrl: brandingImageUrl || undefined,
        })
      : await createSabpayPaymentPage({
          title: t,
          description: description.trim() || undefined,
          slug: slug.trim(),
          amountType,
          ...sharedAmounts,
          fields: builtFields.length > 0 ? builtFields : undefined,
          brandingImageUrl: brandingImageUrl || undefined,
        });
    setSaving(false);

    if (result.error || !result.page) {
      setFormError(result.error || 'Could not save the page.');
      return;
    }
    toast({
      title: isEdit ? 'Payment page saved' : 'Payment page created',
      description: result.page.url,
      tone: 'success',
    });
    router.push('/sabpay/payment-pages');
    router.refresh();
  }

  const slugHelp = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={MONO}>{previewUrl}</span>
      {isEdit ? (
        <>The page URL can’t be changed after creation.</>
      ) : slugStatus === 'checking' ? (
        <Badge tone="neutral">Checking…</Badge>
      ) : slugStatus === 'available' ? (
        <Badge tone="success">Available</Badge>
      ) : null}
    </span>
  );

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ── Left: the form ─────────────────────────────────────────────── */}
      <form
        onSubmit={handleSave}
        style={{
          flex: '1 1 420px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Title" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Annual conference pass"
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Description" help="Shown under the title on the hosted page.">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Includes all three days and lunch."
                  maxLength={300}
                />
              </Field>
              <Field
                label="Slug"
                required={!isEdit}
                error={!isEdit && slugStatus === 'taken' ? 'This slug is already taken.' : null}
                help={slugHelp}
              >
                <Input
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, ''),
                    )
                  }
                  placeholder="annual-conference"
                  disabled={isEdit}
                  required={!isEdit}
                  maxLength={80}
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amount</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SegmentedControl
                aria-label="Amount type"
                items={
                  isEdit
                    ? AMOUNT_TYPES.map((t) => ({ ...t, disabled: t.value !== amountType }))
                    : AMOUNT_TYPES
                }
                value={amountType}
                onChange={setAmountType}
              />
              {isEdit ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--st-text-muted)' }}>
                  The amount type is set when the page is created.
                </p>
              ) : null}
              {amountType === 'fixed' ? (
                <Field label="Amount (₹)" required>
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="499"
                    required
                  />
                </Field>
              ) : (
                <Field
                  label="Minimum amount (₹)"
                  help="Optional. Customers can pay any amount at or above this."
                >
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    inputMode="decimal"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="100"
                  />
                </Field>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {brandingImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandingImageUrl}
                  alt="Hero image preview"
                  style={{
                    width: 96,
                    height: 56,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid var(--st-border)',
                  }}
                />
              ) : null}
              <SabFilePickerButton
                accept="image"
                onPick={(p) => setBrandingImageUrl(p.url)}
              >
                <ImagePlus size={15} aria-hidden="true" />
                {brandingImageUrl ? 'Change hero image' : 'Choose hero image'}
              </SabFilePickerButton>
              {brandingImageUrl ? (
                <Button variant="ghost" size="sm" onClick={() => setBrandingImageUrl('')}>
                  Remove
                </Button>
              ) : null}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--st-text-muted)' }}>
              Shown full-width at the top of the hosted page.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom fields</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fields.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--st-text-muted)' }}>
                  Collect extra details from the payer — name, email, seat number…
                </p>
              ) : (
                fields.map((f, i) => (
                  <div
                    key={f.localId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '2 1 160px', minWidth: 0 }}>
                      <Input
                        value={f.label}
                        onChange={(e) => updateField(f.localId, { label: e.target.value })}
                        placeholder="Field label"
                        aria-label={`Field ${i + 1} label`}
                      />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <SelectField
                        aria-label={`Field ${i + 1} type`}
                        options={FIELD_TYPE_OPTIONS}
                        value={f.type}
                        onChange={(v) => updateField(f.localId, { type: v ?? 'text' })}
                        block
                      />
                    </div>
                    <Switch
                      checked={f.required}
                      onCheckedChange={(c) => updateField(f.localId, { required: c })}
                      label="Required"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove field ${f.label || i + 1}`}
                      iconLeft={<Trash2 size={14} />}
                      onClick={() => removeField(f.localId)}
                    />
                  </div>
                ))
              )}
              <div>
                <Button variant="secondary" iconLeft={<Plus size={15} />} onClick={addField}>
                  Add field
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Create page'}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/sabpay/payment-pages">Cancel</Link>
          </Button>
          {formError ? (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--st-danger, #dc2626)' }}>
              {formError}
            </p>
          ) : null}
        </div>
      </form>

      {/* ── Right: live preview ────────────────────────────────────────── */}
      <div style={{ flex: '1 1 320px', minWidth: 0, maxWidth: 460, position: 'sticky', top: 16 }}>
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardBody>
            <div
              style={{
                border: '1px solid var(--st-border)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {brandingImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandingImageUrl}
                  alt=""
                  style={{ display: 'block', width: '100%', height: 140, objectFit: 'cover' }}
                />
              ) : null}
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17 }}>{title || 'Untitled page'}</h3>
                  {description ? (
                    <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--st-text-muted)' }}>
                      {description}
                    </p>
                  ) : null}
                </div>

                {amountType === 'fixed' ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 24,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fixedPaise != null ? formatSabpayAmount(fixedPaise) : '₹—'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--st-text-muted)' }}>
                      Amount (₹)
                    </span>
                    <Input disabled placeholder="Enter amount" aria-label="Amount (preview)" />
                    {minPaise != null ? (
                      <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>
                        Minimum {formatSabpayAmount(minPaise)}
                      </span>
                    ) : null}
                  </div>
                )}

                {fields.map((f, i) => (
                  <div key={f.localId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--st-text-muted)' }}>
                      {f.label || `Field ${i + 1}`}
                      {f.required ? ' *' : ''}
                    </span>
                    <Input
                      disabled
                      placeholder={FIELD_PLACEHOLDER[f.type] ?? 'Your answer'}
                      aria-label={`${f.label || `Field ${i + 1}`} (preview)`}
                    />
                  </div>
                ))}

                <Button variant="primary" block disabled>
                  {amountType === 'fixed' && fixedPaise != null
                    ? `Pay ${formatSabpayAmount(fixedPaise)}`
                    : 'Pay'}
                </Button>

                <p
                  style={{
                    margin: 0,
                    fontSize: 11.5,
                    color: 'var(--st-text-muted)',
                    textAlign: 'center',
                  }}
                >
                  Powered by SabPay · {mode} mode
                </p>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--st-text-muted)' }}>
              Hosted at <span style={MONO}>{previewUrl}</span>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
