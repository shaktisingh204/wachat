'use client';

/**
 * SabCheckout page editor — used both for "new" and "[pageId]" routes.
 *
 * Sections:
 *   • Basics: slug, displayName, headline, description
 *   • Theme: logo (SabFiles), accent color
 *   • Items: amount-and/or-plan rows with optional quantity
 *   • Required fields: name/email/phone toggles + custom keys
 *   • Redirects: successUrl / cancelUrl
 *   • Status toggle (draft / live / paused)
 *
 * Theme assets MUST come from SabFiles — there is no URL paste field.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
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
  /** Undefined → "new" mode. */
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
  const { toast } = useZoruToast();
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
      toast({ title: 'Save failed', description: res.error });
      return;
    }
    toast({ title: 'Saved' });
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
      toast({ title: 'Delete failed', description: res.error });
      return;
    }
    router.push('/dashboard/sabcheckout');
  }

  return (
    <div className="zoruui space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? 'New payment page' : form.displayName || 'Edit page'}
          </h1>
          <p className="text-sm text-[var(--zoru-muted-fg)]">
            {isNew
              ? 'Build a branded, shareable payment page.'
              : `Public URL: /pay/${form.slug || initial?.slug || ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="ghost" onClick={onDelete} disabled={busy}>
              <Trash2 className="mr-1 size-4" />
              Delete
            </Button>
          )}
          <Button onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      {/* Basics */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Basics</ZoruCardTitle>
          <ZoruCardDescription>Slug, display name, and copy.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              placeholder="my-product"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="Acme Subscription"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={form.headline}
              onChange={(e) => update('headline', e.target.value)}
              placeholder="Get started in seconds"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => update('currency', e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) => update('mode', v as SabcheckoutPageMode)}
            >
              <ZoruSelectTrigger id="mode">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="one_off">One-off</ZoruSelectItem>
                <ZoruSelectItem value="recurring">Recurring</ZoruSelectItem>
                <ZoruSelectItem value="both">Both</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update('status', v as SabcheckoutPageStatus)}
            >
              <ZoruSelectTrigger id="status">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="live">Live</ZoruSelectItem>
                <ZoruSelectItem value="paused">Paused</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Theme */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Theme</ZoruCardTitle>
          <ZoruCardDescription>
            Logo (from your SabFiles library) and accent colour.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Logo</Label>
            <SabFilePickerButton
              accept="image"
              onPick={(pick) => update('logoFileId', pick.id)}
            >
              {form.logoFileId ? 'Change logo' : 'Choose logo'}
            </SabFilePickerButton>
            {form.logoFileId ? (
              <p className="text-xs text-[var(--zoru-muted-fg)]">
                File: {form.logoFileId}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent">Accent colour</Label>
            <Input
              id="accent"
              type="color"
              value={form.accent}
              onChange={(e) => update('accent', e.target.value)}
            />
          </div>
        </ZoruCardContent>
      </Card>

      {/* Items */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Items</ZoruCardTitle>
          <ZoruCardDescription>
            One-off amounts and recurring plans this page offers.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          {form.items.map((it, i) => (
            <div
              key={i}
              className="grid items-end gap-3 rounded-md border border-[var(--zoru-border)] p-3 sm:grid-cols-[120px_1fr_180px_120px_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Badge variant="secondary">{it.type}</Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={it.label}
                  onChange={(e) => updateItem(i, { label: e.target.value })}
                />
              </div>
              {it.type === 'amount' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Amount (minor units)</Label>
                  <Input
                    type="number"
                    value={it.amountMinor ?? 0}
                    onChange={(e) =>
                      updateItem(i, { amountMinor: Number(e.target.value) })
                    }
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Plan</Label>
                  <Select
                    value={it.planId ?? ''}
                    onValueChange={(v) => updateItem(i, { planId: v })}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Pick a plan" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {plans.map((p) => (
                        <ZoruSelectItem key={p._id} value={p._id}>
                          {p.name}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Qty</Label>
                <Switch
                  checked={!!it.allowQuantity}
                  onCheckedChange={(v) => updateItem(i, { allowQuantity: v })}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(i)}
                aria-label="Remove item"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addItem('amount')}>
              <Plus className="mr-1 size-4" />
              Add amount
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addItem('plan')}
              disabled={plans.length === 0}
            >
              <Plus className="mr-1 size-4" />
              Add plan
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Required fields */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Required customer fields</ZoruCardTitle>
          <ZoruCardDescription>
            What we ask the payer on the public form.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          {form.requireFields.map((f, i) => (
            <div
              key={i}
              className="grid items-end gap-3 rounded-md border border-[var(--zoru-border)] p-3 sm:grid-cols-[1fr_1fr_100px_auto]"
            >
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={f.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  disabled={!f.custom}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Required</Label>
                <Switch
                  checked={!!f.required}
                  onCheckedChange={(v) => updateField(i, { required: v })}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeField(i)}
                aria-label="Remove field"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addCustomField}>
            <Plus className="mr-1 size-4" />
            Add custom field
          </Button>
        </ZoruCardContent>
      </Card>

      {/* Redirects */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Redirects</ZoruCardTitle>
          <ZoruCardDescription>
            Where to send the payer after success or cancel. Leave blank to
            use the built-in `/pay/[slug]/success` and `/cancel` routes.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="successUrl">Success URL</Label>
            <Input
              id="successUrl"
              value={form.successUrl}
              onChange={(e) => update('successUrl', e.target.value)}
              placeholder="https://example.com/thank-you"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancelUrl">Cancel URL</Label>
            <Input
              id="cancelUrl"
              value={form.cancelUrl}
              onChange={(e) => update('cancelUrl', e.target.value)}
              placeholder="https://example.com/checkout"
            />
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
