'use client';

/**
 * SabBigin — General settings form (client).
 *
 * Persists the tenant's defaults — currency, default pipeline, and public
 * branding (company name, logo via SabFiles, accent colour) — through
 * `updateSabbiginConfig`. A config row is guaranteed to exist first via
 * `ensureSabbiginConfig` (the synthetic default returned by `getSabbiginConfig`
 * has an empty `_id`, which cannot be written to).
 */

import * as React from 'react';
import { Image as ImageIcon, Save, Trash2 } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  SelectField,
  Separator,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  ensureSabbiginConfig,
  updateSabbiginConfig,
} from '@/app/actions/sabbigin.actions';

export interface PipelineOption {
  id: string;
  name: string;
}

export interface GeneralSettingsFormProps {
  configId: string | null;
  currency: string;
  defaultPipelineId: string | null;
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
  pipelines: PipelineOption[];
}

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'Indian Rupee (₹ INR)' },
  { value: 'USD', label: 'US Dollar ($ USD)' },
  { value: 'EUR', label: 'Euro (€ EUR)' },
  { value: 'GBP', label: 'British Pound (£ GBP)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
  { value: 'AUD', label: 'Australian Dollar (A$ AUD)' },
  { value: 'CAD', label: 'Canadian Dollar (C$ CAD)' },
  { value: 'SGD', label: 'Singapore Dollar (S$ SGD)' },
];

const DEFAULT_ACCENT = '#3b7af5';

export function GeneralSettingsForm(props: GeneralSettingsFormProps) {
  const [currency, setCurrency] = React.useState(props.currency || 'INR');
  const [pipelineId, setPipelineId] = React.useState(
    props.defaultPipelineId ?? '',
  );
  const [companyName, setCompanyName] = React.useState(props.companyName);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(props.logoUrl);
  const [accent, setAccent] = React.useState(props.accentColor || DEFAULT_ACCENT);
  const [saving, setSaving] = React.useState(false);

  const pipelineOptions: SelectOption[] = [
    { value: '', label: 'No default pipeline' },
    ...props.pipelines.map((p) => ({ value: p.id, label: p.name })),
  ];

  async function handleSave() {
    setSaving(true);
    try {
      // Ensure a real persisted config row exists before patching.
      let id = props.configId;
      if (!id) {
        const ensured = await ensureSabbiginConfig();
        id = ensured.id;
      }
      if (!id) {
        toast.error({
          title: 'Could not save',
          description: 'No configuration row is available for this account.',
        });
        return;
      }

      const res = await updateSabbiginConfig(id, {
        defaultCurrency: currency,
        pipelineId: pipelineId || undefined,
        publicBranding: {
          companyName: companyName.trim() || null,
          logoUrl: logoUrl || null,
          accentColor: accent || null,
        },
      });

      if (res.success) {
        toast.success({
          title: 'Settings saved',
          description: 'Your SabBigin defaults have been updated.',
        });
      } else {
        toast.error({
          title: 'Could not save',
          description: res.error ?? 'Please try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="none">
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5 pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Default currency" help="Used across deals, dashboards, and forms.">
            <SelectField
              options={CURRENCY_OPTIONS}
              value={currency}
              onChange={(v) => setCurrency(v ?? 'INR')}
              placeholder="Select a currency"
            />
          </Field>

          <Field
            label="Default pipeline"
            help="The pipeline the deals board opens on by default."
          >
            <SelectField
              options={pipelineOptions}
              value={pipelineId}
              onChange={(v) => setPipelineId(v ?? '')}
              placeholder="No default pipeline"
            />
          </Field>
        </div>

        <Separator />

        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--st-text)]">
            Public branding
          </h3>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Shown on hosted lead forms and booking pages.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Studio"
              maxLength={80}
            />
          </Field>

          <Field label="Accent colour" help="Brand colour for hosted surfaces.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Accent colour"
                className="h-9 w-12 cursor-pointer rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
              />
              <Input
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Accent colour hex"
                className="font-mono"
                maxLength={9}
              />
            </div>
          </Field>
        </div>

        <Field label="Logo">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
              aria-hidden="true"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-5 w-5 text-[var(--st-text-tertiary)]" />
              )}
            </span>
            <SabFilePickerButton
              accept="image"
              variant="outline"
              onPick={(pick) => setLogoUrl(pick.url)}
            >
              {logoUrl ? 'Replace logo' : 'Choose logo'}
            </SabFilePickerButton>
            {logoUrl ? (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => setLogoUrl(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </Field>

        <Separator />

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            iconLeft={Save}
            loading={saving}
            onClick={handleSave}
          >
            Save settings
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
