'use client';

/**
 * SabCheckout page editor, used both for "new" and "[pageId]" routes.
 *
 * Sections:
 *   - Basics: slug, displayName, headline, description
 *   - Theme: logo (SabFiles), accent color
 *   - Items: amount and/or plan rows with optional quantity
 *   - Required fields: name/email/phone toggles + custom keys
 *   - Redirects: successUrl / cancelUrl
 *   - Status toggle (draft / live / paused)
 *
 * Theme assets MUST come from SabFiles, there is no URL paste field.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  IconButton,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
  createSabcheckoutPage,
  deleteSabcheckoutPage,
  updateSabcheckoutPage,
} from '@/app/actions/sabcheckout.actions';
import type {
  SabcheckoutCheckoutItem,
  SabcheckoutItemType,
  SabcheckoutPageDoc,
  SabcheckoutPageMode,
  SabcheckoutPageStatus,
  SabcheckoutRequiredField,
} from '@/lib/rust-client/sabcheckout-pages';
import type { SabcheckoutPlanDoc } from '@/lib/rust-client/sabcheckout-plans';

export interface SabcheckoutPageEditorProps {
  /** Undefined means "new" mode. */
  initial?: SabcheckoutPageDoc;
  /** Plan list for the plan-item picker. */
  plans: SabcheckoutPlanDoc[];
}

interface FormState {
  slug: string;
  displayName: string;
  headline: string;
  description: string;
  currency: string;
  mode: SabcheckoutPageMode;
  status: SabcheckoutPageStatus;
  logoFileId?: string;
  accent: string;
  items: SabcheckoutCheckoutItem[];
  requireFields: SabcheckoutRequiredField[];
  successUrl: string;
  cancelUrl: string;
}

function makeInitial(doc?: SabcheckoutPageDoc): FormState {
  const theme = (doc?.themeJson ?? {}) as Record<string, unknown>;
  return {
    slug: doc?.slug ?? '',
    displayName: doc?.displayName ?? '',
    headline: doc?.headline ?? '',
    description: doc?.description ?? '',
    currency: doc?.currency ?? 'INR',
    mode: doc?.mode ?? 'one_off',
    status: doc?.status ?? 'draft',
    logoFileId: doc?.logoFileId,
    accent: (typeof theme.accent === 'string' && theme.accent) || '#6366f1',
    items:
      doc?.items && doc.items.length > 0
        ? doc.items
        : [{ type: 'amount', label: 'Payment', amountMinor: 50000, allowQuantity: false }],
    requireFields:
      doc?.requireFields && doc.requireFields.length > 0
        ? doc.requireFields
        : [
            { name: 'name', label: 'Full name', custom: false, required: true },
            { name: 'email', label: 'Email', custom: false, required: true },
          ],
    successUrl: doc?.successUrl ?? '',
    cancelUrl: doc?.cancelUrl ?? '',
  };
}

export function SabcheckoutPageEditor({
  initial,
  plans,
}: SabcheckoutPageEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState>(() => makeInitial(initial));
  const [busy, setBusy] = React.useState(false);
  const isNew = !initial;

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function updateItem(i: number, patch: Partial<SabcheckoutCheckoutItem>) {
    setForm((s) => ({
      ...s,
      items: s.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }

  function addItem(type: SabcheckoutItemType) {
    setForm((s) => ({
      ...s,
      items: [
        ...s.items,
        type === 'amount'
          ? { type, label: 'Item', amountMinor: 10000, allowQuantity: false }
          : { type, label: 'Plan', planId: plans[0]?._id, allowQuantity: false },
      ],
    }));
  }

  function removeItem(i: number) {
    setForm((s) => ({ ...s, items: s.items.filter((_, idx) => idx !== i) }));
  }

  function addCustomField() {
    setForm((s) => ({
      ...s,
      requireFields: [
        ...s.requireFields,
        { name: `custom_${s.requireFields.length}`, label: 'Custom field', custom: true, required: false },
      ],
    }));
  }

  function updateField(i: number, patch: Partial<SabcheckoutRequiredField>) {
    setForm((s) => ({
      ...s,
      requireFields: s.requireFields.map((f, idx) =>
        idx === i ? { ...f, ...patch } : f,
      ),
    }));
  }

  function removeField(i: number) {
    setForm((s) => ({
      ...s,
      requireFields: s.requireFields.filter((_, idx) => idx !== i),
    }));
  }

  async function onSave() {
    if (!form.slug.trim() || !form.displayName.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Slug and display name are required.',
        tone: 'warning',
      });
      return;
    }
    setBusy(true);
    const payload = {
      slug: form.slug.trim().toLowerCase(),
      displayName: form.displayName.trim(),
      headline: form.headline || undefined,
      description: form.description || undefined,
      currency: form.currency || 'INR',
      mode: form.mode,
      status: form.status,
      logoFileId: form.logoFileId,
      themeJson: { accent: form.accent },
      items: form.items,
      requireFields: form.requireFields,
      successUrl: form.successUrl || undefined,
      cancelUrl: form.cancelUrl || undefined,
    };
    const res = isNew
      ? await createSabcheckoutPage(payload)
      : await updateSabcheckoutPage(initial!._id, payload);
    setBusy(false);
    if (!res.ok) {
      toast.error({ title: 'Save failed', description: res.error });
      return;
    }
    toast.success('Saved');
    if (isNew && 'id' in res) {
      router.push(`/dashboard/sabcheckout/${res.id}`);
    } else {
      router.refresh();
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!confirm('Delete this page? This cannot be undone.')) return;
    setBusy(true);
    const res = await deleteSabcheckoutPage(initial._id);
    setBusy(false);
    if (!res.ok) {
      toast.error({ title: 'Delete failed', description: res.error });
      return;
    }
    router.push('/dashboard/sabcheckout');
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{isNew ? 'New payment page' : form.displayName || 'Edit page'}</PageTitle>
          <PageDescription>
            {isNew
              ? 'Build a branded, shareable payment page.'
              : `Public URL: /pay/${form.slug || initial?.slug || ''}`}
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          {!isNew && (
            <Button variant="ghost" iconLeft={Trash2} onClick={onDelete} disabled={busy}>
              Delete
            </Button>
          )}
          <Button variant="primary" onClick={onSave} loading={busy}>
            {busy ? 'Saving' : 'Save'}
          </Button>
        </PageActions>
      </PageHeader>

      {/* Basics */}
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Slug, display name, and copy.</CardDescription>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug" required>
            <Input
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              placeholder="my-product"
            />
          </Field>
          <Field label="Display name" required>
            <Input
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="Acme Subscription"
            />
          </Field>
          <Field label="Headline" className="sm:col-span-2">
            <Input
              value={form.headline}
              onChange={(e) => update('headline', e.target.value)}
              placeholder="Get started in seconds"
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={form.currency}
              onChange={(e) => update('currency', e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="Mode">
            <Select
              value={form.mode}
              onValueChange={(v) => update('mode', v as SabcheckoutPageMode)}
            >
              <SelectTrigger aria-label="Mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_off">One-off</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onValueChange={(v) => update('status', v as SabcheckoutPageStatus)}
            >
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardBody>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Logo (from your SabFiles library) and accent colour.
          </CardDescription>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Logo"
            help={form.logoFileId ? `File: ${form.logoFileId}` : undefined}
          >
            <div>
              <SabFilePickerButton
                accept="image"
                onPick={(pick) => update('logoFileId', pick.id)}
              >
                {form.logoFileId ? 'Change logo' : 'Choose logo'}
              </SabFilePickerButton>
            </div>
          </Field>
          <Field label="Accent colour">
            <Input
              type="color"
              value={form.accent}
              onChange={(e) => update('accent', e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            One-off amounts and recurring plans this page offers.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          {form.items.map((it, i) => (
            <div
              key={i}
              className="grid items-end gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 sm:grid-cols-[120px_1fr_180px_120px_auto]"
            >
              <Field label="Type">
                <div>
                  <Badge tone="neutral">{it.type}</Badge>
                </div>
              </Field>
              <Field label="Label">
                <Input
                  value={it.label}
                  onChange={(e) => updateItem(i, { label: e.target.value })}
                />
              </Field>
              {it.type === 'amount' ? (
                <Field label="Amount (minor units)">
                  <Input
                    type="number"
                    value={it.amountMinor ?? 0}
                    onChange={(e) =>
                      updateItem(i, { amountMinor: Number(e.target.value) })
                    }
                  />
                </Field>
              ) : (
                <Field label="Plan">
                  <Select
                    value={it.planId ?? ''}
                    onValueChange={(v) => updateItem(i, { planId: v })}
                  >
                    <SelectTrigger aria-label="Plan">
                      <SelectValue placeholder="Pick a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Qty">
                <Switch
                  checked={!!it.allowQuantity}
                  onCheckedChange={(v) => updateItem(i, { allowQuantity: v })}
                  aria-label="Allow quantity"
                />
              </Field>
              <IconButton
                label="Remove item"
                icon={Trash2}
                variant="ghost"
                size="sm"
                onClick={() => removeItem(i)}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" iconLeft={Plus} onClick={() => addItem('amount')}>
              Add amount
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Plus}
              onClick={() => addItem('plan')}
              disabled={plans.length === 0}
            >
              Add plan
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Required fields */}
      <Card>
        <CardHeader>
          <CardTitle>Required customer fields</CardTitle>
          <CardDescription>
            What we ask the payer on the public form.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          {form.requireFields.map((f, i) => (
            <div
              key={i}
              className="grid items-end gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 sm:grid-cols-[1fr_1fr_100px_auto]"
            >
              <Field label="Key">
                <Input
                  value={f.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  disabled={!f.custom}
                />
              </Field>
              <Field label="Label">
                <Input
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                />
              </Field>
              <Field label="Required">
                <Switch
                  checked={!!f.required}
                  onCheckedChange={(v) => updateField(i, { required: v })}
                  aria-label="Required field"
                />
              </Field>
              <IconButton
                label="Remove field"
                icon={Trash2}
                variant="ghost"
                size="sm"
                onClick={() => removeField(i)}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" iconLeft={Plus} onClick={addCustomField}>
            Add custom field
          </Button>
        </CardBody>
      </Card>

      {/* Redirects */}
      <Card>
        <CardHeader>
          <CardTitle>Redirects</CardTitle>
          <CardDescription>
            Where to send the payer after success or cancel. Leave blank to
            use the built-in /pay/[slug]/success and /cancel routes.
          </CardDescription>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Success URL">
            <Input
              value={form.successUrl}
              onChange={(e) => update('successUrl', e.target.value)}
              placeholder="https://example.com/thank-you"
            />
          </Field>
          <Field label="Cancel URL">
            <Input
              value={form.cancelUrl}
              onChange={(e) => update('cancelUrl', e.target.value)}
              placeholder="https://example.com/checkout"
            />
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}
