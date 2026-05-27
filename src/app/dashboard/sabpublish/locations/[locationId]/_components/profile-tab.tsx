'use client';

import * as React from 'react';

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Textarea,
} from '@/components/zoruui';
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
  const [message, setMessage] = React.useState<string | null>(null);

  function handleChange(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleSave() {
    setMessage(null);
    const fields = Object.entries(values).map(([fieldKey, value]) => ({
      fieldKey,
      value,
    }));
    startTransition(async () => {
      const res = await saveSabpublishProfileFields(locationId, fields);
      setMessage(res.ok ? `Saved ${res.data.upserted} fields.` : res.error);
    });
  }

  function handleSyncAll() {
    setMessage(null);
    startTransition(async () => {
      const res = await syncSabpublishLocation(
        locationId,
        ALL_SABPUBLISH_PROVIDER_IDS as SabpublishProviderId[],
      );
      setMessage(
        res.ok
          ? `Dispatched ${res.data.jobs.length} sync jobs.`
          : res.error,
      );
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div
              key={f.key}
              className={f.multiline ? 'sm:col-span-2' : undefined}
            >
              <Label htmlFor={`field-${f.key}`}>{f.label}</Label>
              {f.multiline ? (
                <Textarea
                  id={`field-${f.key}`}
                  rows={3}
                  value={values[f.key] ?? ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                />
              ) : (
                <Input
                  id={`field-${f.key}`}
                  value={values[f.key] ?? ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        {message ? (
          <p className="text-sm text-zoru-ink-muted">{message}</p>
        ) : null}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={pending}
          >
            Sync to all providers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
