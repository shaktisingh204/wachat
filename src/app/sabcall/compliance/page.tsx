'use client';

import * as React from 'react';
import { ShieldCheck, Save } from 'lucide-react';

import {
  Button,
  Card,
  Field,
  Input,
  SelectField,
  Skeleton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  getCompliance,
  saveCompliance,
  type ComplianceSettings,
} from './actions';

const ATTESTATION_OPTIONS = [
  { value: 'A', label: 'A — Full attestation' },
  { value: 'B', label: 'B — Partial attestation' },
  { value: 'C', label: 'C — Gateway attestation' },
];

const CONSENT_OPTIONS = [
  { value: 'none', label: 'No recording' },
  { value: 'one_party', label: 'One-party consent' },
  { value: 'all_party', label: 'All-party consent' },
];

export default function SabcallCompliancePage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<ComplianceSettings | null>(null);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await getCompliance();
        if (alive) setSettings(data);
      } catch (e) {
        if (alive) toast.error(`Could not load compliance settings: ${(e as Error).message}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  const patch = React.useCallback((next: Partial<ComplianceSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  const patchE911 = React.useCallback(
    (next: Partial<ComplianceSettings['e911']>) => {
      setSettings((prev) => (prev ? { ...prev, e911: { ...prev.e911, ...next } } : prev));
    },
    [],
  );

  const save = React.useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await saveCompliance(settings);
      if (res.success) {
        toast.success('Compliance settings saved');
      } else {
        toast.error(`Save failed: ${res.error}`);
      }
    } finally {
      setSaving(false);
    }
  }, [settings, toast]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Compliance &amp; trust</PageTitle>
          <PageDescription>
            Carrier-trust posture for your voice numbers — STIR/SHAKEN, caller ID,
            E911, recording consent, and campaign registration.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {loading || !settings ? (
        <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Caller identity
            </div>

            <Field label="STIR/SHAKEN attestation">
              <SelectField
                value={settings.stirShakenAttestation}
                onChange={(v) =>
                  patch({
                    stirShakenAttestation:
                      (v as ComplianceSettings['stirShakenAttestation']) ?? 'A',
                  })
                }
                options={ATTESTATION_OPTIONS}
              />
            </Field>

            <Field label="CNAM display name">
              <Input
                value={settings.cnamName ?? ''}
                onChange={(e) => patch({ cnamName: e.target.value })}
                placeholder="e.g. Acme Support"
                maxLength={15}
              />
            </Field>
          </Card>

          <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
            <div className="text-sm font-medium text-[var(--st-text)]">
              E911 registered address
            </div>

            <Field label="Street">
              <Input
                value={settings.e911.street ?? ''}
                onChange={(e) => patchE911({ street: e.target.value })}
                placeholder="123 Main St, Suite 100"
              />
            </Field>

            <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
              <Field label="City">
                <Input
                  value={settings.e911.city ?? ''}
                  onChange={(e) => patchE911({ city: e.target.value })}
                  placeholder="San Francisco"
                />
              </Field>
              <Field label="State / region">
                <Input
                  value={settings.e911.state ?? ''}
                  onChange={(e) => patchE911({ state: e.target.value })}
                  placeholder="CA"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
              <Field label="Postal code">
                <Input
                  value={settings.e911.postal ?? ''}
                  onChange={(e) => patchE911({ postal: e.target.value })}
                  placeholder="94105"
                />
              </Field>
              <Field label="Country">
                <Input
                  value={settings.e911.country ?? ''}
                  onChange={(e) => patchE911({ country: e.target.value })}
                  placeholder="US"
                />
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
            <div className="text-sm font-medium text-[var(--st-text)]">
              Recording &amp; consent
            </div>

            <Field label="Call-recording consent policy">
              <SelectField
                value={settings.recordingConsent}
                onChange={(v) =>
                  patch({
                    recordingConsent:
                      (v as ComplianceSettings['recordingConsent']) ?? 'one_party',
                  })
                }
                options={CONSENT_OPTIONS}
              />
            </Field>
          </Card>

          <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-5)]">
            <div className="text-sm font-medium text-[var(--st-text)]">
              Campaign registration
            </div>

            <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
              <Field label="US A2P 10DLC brand id">
                <Input
                  value={settings.a2pBrandId ?? ''}
                  onChange={(e) => patch({ a2pBrandId: e.target.value })}
                  placeholder="BXXXXXXX"
                />
              </Field>
              <Field label="US A2P 10DLC campaign id">
                <Input
                  value={settings.a2pCampaignId ?? ''}
                  onChange={(e) => patch({ a2pCampaignId: e.target.value })}
                  placeholder="CXXXXXXX"
                />
              </Field>
            </div>

            <Field label="India DLT entity id">
              <Input
                value={settings.dltEntityId ?? ''}
                onChange={(e) => patch({ dltEntityId: e.target.value })}
                placeholder="11015XXXXXXXXXXXXX"
              />
            </Field>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="primary"
              iconLeft={Save}
              loading={saving}
              disabled={saving}
              onClick={() => void save()}
              className="sc-press"
            >
              Save
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
