'use client';

import * as React from 'react';
import { RefreshCw, Save, UserSquare } from 'lucide-react';

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
  Textarea,
} from '@/components/sabcrm/20ui';
import {
  saveSabpublishProfileFields,
  syncSabpublishLocation,
} from '@/app/actions/sabpublish.actions';
import type { SabpublishProfileFieldDoc } from '@/lib/rust-client/sabpublish-profile-fields';
import {
  ALL_SABPUBLISH_PROVIDER_IDS,
  type SabpublishProviderId,
} from '@/lib/sabpublish/provider-ids';

const FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Business name' },
  { key: 'description', label: 'Description', multiline: true },
  { key: 'address', label: 'Full address' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website URL' },
  { key: 'hours', label: 'Hours (free text)', multiline: true },
  { key: 'category.primary', label: 'Primary category' },
];

export function SabpublishProfileTab({
  locationId,
  initial,
}: {
  locationId: string;
  initial: SabpublishProfileFieldDoc[];
}) {
  const initialMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of initial) m[f.fieldKey] = f.value;
    return m;
  }, [initial]);

  const [values, setValues] = React.useState<Record<string, string>>(initialMap);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);

  function handleChange(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleSave() {
    setResult(null);
    const fields = Object.entries(values).map(([fieldKey, value]) => ({
      fieldKey,
      value,
    }));
    startTransition(async () => {
      const res = await saveSabpublishProfileFields(locationId, fields);
      setResult(
        res.ok
          ? { tone: 'success', message: `Saved ${res.data.upserted} fields.` }
          : { tone: 'danger', message: res.error },
      );
    });
  }

  function handleSyncAll() {
    setResult(null);
    startTransition(async () => {
      const res = await syncSabpublishLocation(
        locationId,
        ALL_SABPUBLISH_PROVIDER_IDS as SabpublishProviderId[],
      );
      setResult(
        res.ok
          ? {
              tone: 'success',
              message: `Dispatched ${res.data.jobs.length} sync jobs.`,
            }
          : { tone: 'danger', message: res.error },
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserSquare size={16} aria-hidden="true" />
          <CardTitle>Profile fields</CardTitle>
        </div>
        <CardDescription>
          The source of truth pushed out to every connected provider.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              className={f.multiline ? 'sm:col-span-2' : undefined}
            >
              {f.multiline ? (
                <Textarea
                  rows={3}
                  value={values[f.key] ?? ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                />
              ) : (
                <Input
                  value={values[f.key] ?? ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
        {result ? (
          <Alert
            tone={result.tone}
            title={result.tone === 'success' ? 'Profile updated' : 'Action failed'}
          >
            {result.message}
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            iconLeft={Save}
            onClick={handleSave}
            loading={pending}
          >
            Save profile
          </Button>
          <Button
            variant="secondary"
            iconLeft={RefreshCw}
            onClick={handleSyncAll}
            disabled={pending}
          >
            Sync to all providers
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
