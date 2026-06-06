'use client';

import { Card } from '@/components/sabcrm/20ui';
import { EntityPicker } from '@/components/crm/entity-picker';

/**
 * Internal Phase-1 demo route — exercises every new reference-data
 * picker (country, state, city, timezone, language, salutation,
 * leadSource, jobTitle) and the cascading filter wiring.
 *
 * Delete this directory once Phase 2 (form migrations) is complete.
 */

import * as React from 'react';

export default function PickerDemoPage() {
  const [country, setCountry] = React.useState<string | null>('IN');
  const [stateVal, setStateVal] = React.useState<string | null>(null);
  const [city, setCity] = React.useState<string | null>(null);
  const [tz, setTz] = React.useState<string | null>(null);
  const [lang, setLang] = React.useState<string | null>('en');
  const [salutation, setSalutation] = React.useState<string | null>(null);
  const [leadSource, setLeadSource] = React.useState<string | null>(null);
  const [jobTitle, setJobTitle] = React.useState<string | null>(null);
  const [industry, setIndustry] = React.useState<string | null>(null);
  const [currency, setCurrency] = React.useState<string | null>('INR');

  // The state picker stores `${countryCode}:${stateCode}` — extract the
  // state code for the city filter.
  const stateCode = stateVal?.split(':')[1];

  const allValues = {
    country,
    state: stateVal,
    city,
    timezone: tz,
    language: lang,
    salutation,
    leadSource,
    jobTitle,
    industry,
    currency,
  };

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--st-text)]">Reference-data picker demo</h1>
        <p className="text-sm text-[var(--st-text-secondary)]">
          Phase-1 sanity check — try searching, picking, and inline-creating values.
          Stored values are JSON-dumped below for round-trip verification.
        </p>
      </div>

      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <EntityPicker
          entity="country"
          label="Country"
          value={country}
          onChange={(v) => setCountry(v as string | null)}
          allowCreate
        />
        <EntityPicker
          entity="state"
          label="State (cascading)"
          value={stateVal}
          onChange={(v) => setStateVal(v as string | null)}
          filter={country ? { countryCode: country } : undefined}
          allowCreate
        />
        <EntityPicker
          entity="city"
          label="City (inline-create)"
          value={city}
          onChange={(v) => setCity(v as string | null)}
          filter={
            country
              ? stateCode
                ? { countryCode: country, stateCode }
                : { countryCode: country }
              : undefined
          }
        />
        <EntityPicker
          entity="timezone"
          label="Timezone"
          value={tz}
          onChange={(v) => setTz(v as string | null)}
        />
        <EntityPicker
          entity="language"
          label="Language"
          value={lang}
          onChange={(v) => setLang(v as string | null)}
        />
        <EntityPicker
          entity="salutation"
          label="Salutation (inline-create)"
          value={salutation}
          onChange={(v) => setSalutation(v as string | null)}
        />
        <EntityPicker
          entity="leadSource"
          label="Lead source (inline-create)"
          value={leadSource}
          onChange={(v) => setLeadSource(v as string | null)}
        />
        <EntityPicker
          entity="jobTitle"
          label="Job title (inline-create)"
          value={jobTitle}
          onChange={(v) => setJobTitle(v as string | null)}
        />
        <EntityPicker
          entity="industry"
          label="Industry (inline-create)"
          value={industry}
          onChange={(v) => setIndustry(v as string | null)}
        />
        <EntityPicker
          entity="currency"
          label="Currency"
          value={currency}
          onChange={(v) => setCurrency(v as string | null)}
        />
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          Stored values
        </p>
        <pre className="overflow-x-auto rounded-md bg-[var(--st-bg)] p-3 text-[12px] text-[var(--st-text)]">
          {JSON.stringify(allValues, null, 2)}
        </pre>
      </Card>
    </div>
  );
}
