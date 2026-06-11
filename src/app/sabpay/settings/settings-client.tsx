'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  SegmentedControl,
  toast,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import type { SabpayMerchant, SabpayMode } from '@/lib/sabpay/types';

import { saveSabpaySettings } from '../actions';

export function SettingsClient({ initialMerchant }: { initialMerchant: SabpayMerchant }) {
  const router = useRouter();
  const [businessName, setBusinessName] = React.useState(initialMerchant.businessName);
  const [logoUrl, setLogoUrl] = React.useState(initialMerchant.logoUrl ?? '');
  const [brandColor, setBrandColor] = React.useState(initialMerchant.brandColor ?? '#4f46e5');
  const [mode, setMode] = React.useState<SabpayMode>(initialMerchant.mode);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await saveSabpaySettings({
      businessName,
      logoUrl,
      brandColor,
      mode,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast({ title: 'Settings saved', tone: 'success' });
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--st-space-5, 24px)' }}>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Checkout branding</CardTitle>
            <CardDescription>
              What customers see on your hosted payment page.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Business name" required error={error}>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={120}
                required
              />
            </Field>
            <Field
              label="Logo"
              help="Square works best. Pick from your SabFiles library or upload."
            >
              <SabFileUrlInput
                value={logoUrl}
                onChange={(value) => setLogoUrl(value)}
                accept="image"
                placeholder="No logo chosen"
                pickerTitle="Choose a checkout logo"
              />
            </Field>
            <Field label="Brand color" help="Used for the pay button and accents on checkout.">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  aria-label="Brand color"
                  style={{
                    width: 38,
                    height: 38,
                    padding: 0,
                    border: '1px solid var(--st-border)',
                    borderRadius: 8,
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
                <code style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 13 }}>
                  {brandColor}
                </code>
              </span>
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Mode</CardTitle>
            <CardDescription>
              Controls the dashboard's data view and dashboard-created payment
              links. API calls always follow the key's own prefix (sk_test_ /
              sk_live_), regardless of this switch.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <SegmentedControl
            aria-label="Dashboard mode"
            items={[
              { value: 'test', label: 'Test mode' },
              { value: 'live', label: 'Live mode' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </CardBody>
      </Card>

      <div>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
