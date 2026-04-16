'use client';

import { LuPhone } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import { Field, PanelHeader, inputClass, selectClass } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

const COUNTRY_OPTIONS = [
  { label: 'International', value: '' },
  { label: 'Algeria (+213)', value: 'DZ' },
  { label: 'Argentina (+54)', value: 'AR' },
  { label: 'Australia (+61)', value: 'AU' },
  { label: 'Austria (+43)', value: 'AT' },
  { label: 'Bangladesh (+880)', value: 'BD' },
  { label: 'Belgium (+32)', value: 'BE' },
  { label: 'Brazil (+55)', value: 'BR' },
  { label: 'Canada (+1)', value: 'CA' },
  { label: 'Chile (+56)', value: 'CL' },
  { label: 'China (+86)', value: 'CN' },
  { label: 'Colombia (+57)', value: 'CO' },
  { label: 'Egypt (+20)', value: 'EG' },
  { label: 'France (+33)', value: 'FR' },
  { label: 'Germany (+49)', value: 'DE' },
  { label: 'Ghana (+233)', value: 'GH' },
  { label: 'Greece (+30)', value: 'GR' },
  { label: 'Hong Kong (+852)', value: 'HK' },
  { label: 'India (+91)', value: 'IN' },
  { label: 'Indonesia (+62)', value: 'ID' },
  { label: 'Iran (+98)', value: 'IR' },
  { label: 'Iraq (+964)', value: 'IQ' },
  { label: 'Ireland (+353)', value: 'IE' },
  { label: 'Israel (+972)', value: 'IL' },
  { label: 'Italy (+39)', value: 'IT' },
  { label: 'Japan (+81)', value: 'JP' },
  { label: 'Jordan (+962)', value: 'JO' },
  { label: 'Kenya (+254)', value: 'KE' },
  { label: 'Korea South (+82)', value: 'KR' },
  { label: 'Kuwait (+965)', value: 'KW' },
  { label: 'Malaysia (+60)', value: 'MY' },
  { label: 'Mexico (+52)', value: 'MX' },
  { label: 'Morocco (+212)', value: 'MA' },
  { label: 'Netherlands (+31)', value: 'NL' },
  { label: 'New Zealand (+64)', value: 'NZ' },
  { label: 'Nigeria (+234)', value: 'NG' },
  { label: 'Norway (+47)', value: 'NO' },
  { label: 'Pakistan (+92)', value: 'PK' },
  { label: 'Philippines (+63)', value: 'PH' },
  { label: 'Poland (+48)', value: 'PL' },
  { label: 'Portugal (+351)', value: 'PT' },
  { label: 'Qatar (+974)', value: 'QA' },
  { label: 'Romania (+40)', value: 'RO' },
  { label: 'Russia (+7)', value: 'RU' },
  { label: 'Saudi Arabia (+966)', value: 'SA' },
  { label: 'Singapore (+65)', value: 'SG' },
  { label: 'South Africa (+27)', value: 'ZA' },
  { label: 'Spain (+34)', value: 'ES' },
  { label: 'Sri Lanka (+94)', value: 'LK' },
  { label: 'Sweden (+46)', value: 'SE' },
  { label: 'Switzerland (+41)', value: 'CH' },
  { label: 'Taiwan (+886)', value: 'TW' },
  { label: 'Thailand (+66)', value: 'TH' },
  { label: 'Turkey (+90)', value: 'TR' },
  { label: 'Ukraine (+380)', value: 'UA' },
  { label: 'United Arab Emirates (+971)', value: 'AE' },
  { label: 'United Kingdom (+44)', value: 'GB' },
  { label: 'United States (+1)', value: 'US' },
  { label: 'Uruguay (+598)', value: 'UY' },
  { label: 'Venezuela (+58)', value: 'VE' },
  { label: 'Vietnam (+84)', value: 'VN' },
  { label: 'Zimbabwe (+263)', value: 'ZW' },
] as const;

export function PhoneInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const placeholder = String(options.placeholder ?? '');
  const defaultCountryCode =
    typeof options.defaultCountryCode === 'string' ? options.defaultCountryCode : '';
  const retryMessage = String(
    options.retryMessage ?? 'Invalid phone number. Please try again!',
  );
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuPhone} title="Phone Input" />

      <Field label="Default country">
        <select
          value={defaultCountryCode}
          onChange={(e) => {
            const code = e.target.value || undefined;
            // Keep both fields in sync: `country` is the canonical
            // validation key, `defaultCountryCode` is the legacy UI key.
            update({ defaultCountryCode: code, country: code });
          }}
          className={selectClass}
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={`${c.value}-${c.label}`} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Placeholder text">
        <input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="+1 (555) 000-0000"
          className={inputClass}
        />
      </Field>

      <Field label="Retry message">
        <input
          type="text"
          value={retryMessage}
          onChange={(e) => update({ retryMessage: e.target.value })}
          placeholder="Invalid phone number. Please try again!"
          className={inputClass}
        />
      </Field>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>
    </div>
  );
}
