'use client';

/**
 * /sabcrm/20ui/fields — RecordCell field-system QA showcase.
 *
 * One row per {@link FieldType} (plus an image FILE variant, a system field
 * and an unknown-type degrade row), each rendered through the single
 * `RecordCell` entry in display mode, with a live editor toggle:
 *
 *   1. Display parity — every type renders its Twenty-style read view.
 *   2. Edit round-trip — "Edit" mounts the type's editor; commit writes the
 *      value back (shown in the Value column), Escape cancels.
 *   3. RELATION uses a mock in-memory resolver (label + search).
 *   4. FILE edits go through SabFiles (library + upload — no URL paste).
 *   5. Unknown types degrade to the TEXT pair instead of crashing.
 */

import * as React from 'react';

import type { FieldMetadata, FieldType } from '@/lib/sabcrm/types';
import {
  RecordCell,
  type RelationResolver,
} from '@/components/sabcrm/20ui/composites/record/record-cell';
import { Button } from '@/components/sabcrm/20ui/button';

/* ------------------------------------------------------------ mock data */

const COMPANIES: Array<{ id: string; label: string }> = [
  { id: 'cmp_1', label: 'Acme Industries' },
  { id: 'cmp_2', label: 'Globex Systems' },
  { id: 'cmp_3', label: 'Initech Labs' },
  { id: 'cmp_4', label: 'Umbra Dynamics' },
  { id: 'cmp_5', label: 'Hooli Networks' },
];

interface DemoRow {
  id: string;
  field: FieldMetadata;
  initial: unknown;
  note?: string;
}

const ROWS: DemoRow[] = [
  {
    id: 'text',
    field: { key: 'name', label: 'Name', type: 'TEXT' },
    initial: 'Acme Industries',
  },
  {
    id: 'number',
    field: { key: 'employees', label: 'Employees', type: 'NUMBER' },
    initial: 4821,
  },
  {
    id: 'numeric',
    field: { key: 'precise', label: 'Precise', type: 'NUMERIC' },
    initial: '12345678901234567890.123456789',
    note: 'string-backed high precision',
  },
  {
    id: 'currency',
    field: { key: 'arr', label: 'ARR', type: 'CURRENCY' },
    initial: { amountMicros: 1_250_000_000_000, currencyCode: 'USD' },
    note: 'micros shape round-trips',
  },
  {
    id: 'boolean',
    field: { key: 'active', label: 'Active', type: 'BOOLEAN' },
    initial: true,
  },
  {
    id: 'date',
    field: { key: 'renewal', label: 'Renewal', type: 'DATE' },
    initial: '2026-03-14',
  },
  {
    id: 'datetime',
    field: { key: 'lastSeen', label: 'Last seen', type: 'DATE_TIME' },
    initial: '2026-03-14T15:09:26.000Z',
  },
  {
    id: 'email',
    field: { key: 'email', label: 'Email', type: 'EMAIL' },
    initial: 'ada@acme.com',
  },
  {
    id: 'phone',
    field: { key: 'phone', label: 'Phone', type: 'PHONE' },
    initial: '+1 415 555 0134',
  },
  {
    id: 'link',
    field: { key: 'website', label: 'Website', type: 'LINK' },
    initial: 'https://www.acme.com/pricing',
  },
  {
    id: 'select',
    field: {
      key: 'stage',
      label: 'Stage',
      type: 'SELECT',
      options: [
        { value: 'lead', label: 'Lead', color: 'blue' },
        { value: 'qualified', label: 'Qualified', color: 'purple' },
        { value: 'proposal', label: 'Proposal', color: 'orange' },
        { value: 'won', label: 'Won', color: 'green' },
        { value: 'lost', label: 'Lost', color: 'red' },
      ],
    },
    initial: 'qualified',
  },
  {
    id: 'multiselect',
    field: {
      key: 'tags',
      label: 'Tags',
      type: 'MULTI_SELECT',
      options: [
        { value: 'saas', label: 'SaaS', color: 'blue' },
        { value: 'priority', label: 'Priority', color: 'red' },
        { value: 'partner', label: 'Partner', color: 'green' },
        { value: 'beta', label: 'Beta', color: 'orange' },
      ],
    },
    initial: ['saas', 'priority'],
  },
  {
    id: 'rating',
    field: { key: 'score', label: 'Score', type: 'RATING' },
    initial: 4,
  },
  {
    id: 'relation',
    field: {
      key: 'company',
      label: 'Company',
      type: 'RELATION',
      relation: { targetObject: 'companies', kind: 'MANY_TO_ONE', labelField: 'name' },
    },
    initial: 'cmp_1',
    note: 'mock resolver (label + search)',
  },
  {
    id: 'relation-many',
    field: {
      key: 'subsidiaries',
      label: 'Subsidiaries',
      type: 'RELATION',
      relation: { targetObject: 'companies', kind: 'ONE_TO_MANY', labelField: 'name' },
    },
    initial: ['cmp_2', 'cmp_3'],
    note: 'ONE_TO_MANY appends picks',
  },
  {
    id: 'file',
    field: { key: 'contract', label: 'Contract', type: 'FILE' },
    initial: {
      url: 'https://files.sabnode.com/users/demo/files/2026/03/abcdef1234567890-q2-contract.pdf',
      name: 'Q2 contract.pdf',
    },
    note: 'edits via SabFiles picker',
  },
  {
    id: 'file-image',
    field: { key: 'logo', label: 'Logo (image FILE)', type: 'FILE' },
    initial: 'https://twenty-icons.com/acme.com',
    note: 'image-like → avatar render',
  },
  {
    id: 'fullname',
    field: { key: 'owner', label: 'Owner', type: 'FULL_NAME' },
    initial: { firstName: 'Ada', lastName: 'Lovelace' },
  },
  {
    id: 'address',
    field: { key: 'hq', label: 'HQ', type: 'ADDRESS' },
    initial: {
      addressStreet1: '1 Infinite Loop',
      addressCity: 'Cupertino',
      addressState: 'CA',
      addressPostcode: '95014',
      addressCountry: 'United States',
    },
  },
  {
    id: 'emails',
    field: { key: 'emails', label: 'Emails', type: 'EMAILS' },
    initial: {
      primaryEmail: 'ada@acme.com',
      additionalEmails: ['ops@acme.com', 'billing@acme.com'],
    },
  },
  {
    id: 'phones',
    field: { key: 'phones', label: 'Phones', type: 'PHONES' },
    initial: {
      primaryPhoneNumber: '4155550134',
      primaryPhoneCallingCode: '+1',
      additionalPhones: [{ number: '2025550199', callingCode: '+1' }],
    },
  },
  {
    id: 'links',
    field: { key: 'linkList', label: 'Links', type: 'LINKS' },
    initial: {
      primaryLinkUrl: 'https://acme.com',
      primaryLinkLabel: 'Website',
      secondaryLinks: [{ url: 'https://docs.acme.com', label: 'Docs' }],
    },
  },
  {
    id: 'array',
    field: { key: 'aliases', label: 'Aliases', type: 'ARRAY' },
    initial: ['alpha', 'beta', 'gamma'],
  },
  {
    id: 'rawjson',
    field: { key: 'meta', label: 'Meta', type: 'RAW_JSON' },
    initial: { plan: 'scale', seats: 40, beta: true },
  },
  {
    id: 'actor',
    field: { key: 'createdBy', label: 'Created by', type: 'ACTOR' },
    initial: { source: 'MANUAL', name: 'Harsh Khandelwal' },
    note: 'audit composite — editor renders the display',
  },
  {
    id: 'richtext',
    field: { key: 'notes', label: 'Notes', type: 'RICH_TEXT_V2' },
    initial: { markdown: 'Followed up on the renewal — waiting on legal.' },
  },
  {
    id: 'system',
    field: { key: 'recordId', label: 'Record ID', type: 'TEXT', system: true },
    initial: 'rec_8f3a1c',
    note: 'system field — edit mode forced read-only',
  },
  {
    id: 'unknown',
    field: { key: 'mystery', label: 'Mystery', type: 'GEO_POINT' as FieldType },
    initial: '48.8566, 2.3522',
    note: 'unknown type → TEXT degrade',
  },
];

/* ------------------------------------------------------------ component */

export default function Page(): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, unknown>>(() =>
    Object.fromEntries(ROWS.map((r) => [r.id, r.initial])),
  );
  const [editing, setEditing] = React.useState<Record<string, boolean>>({});
  const [log, setLog] = React.useState<Record<string, string>>({});

  const relationResolver: RelationResolver = React.useMemo(
    () => ({
      label: (_field, value) => {
        const id = typeof value === 'string' ? value : null;
        return id ? COMPANIES.find((c) => c.id === id)?.label ?? null : null;
      },
      search: async (_field, q) => {
        const needle = q.trim().toLowerCase();
        return COMPANIES.filter(
          (c) => !needle || c.label.toLowerCase().includes(needle),
        );
      },
    }),
    [],
  );

  const stopEditing = (id: string): void =>
    setEditing((e) => ({ ...e, [id]: false }));

  return (
    <div className="20ui fields-showcase">
      <style>{`
        :is(.\\32 0ui, .ui20).fields-showcase {
          padding: var(--st-space-5);
          font-family: var(--st-font);
          color: var(--st-text);
          display: flex;
          flex-direction: column;
          gap: var(--st-space-4);
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--st-font-size-sm);
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-table th,
        :is(.\\32 0ui, .ui20).fields-showcase .fs-table td {
          border-bottom: 1px solid var(--st-border);
          padding: var(--st-space-2) var(--st-space-3);
          text-align: left;
          vertical-align: top;
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-table th {
          color: var(--st-text-secondary);
          font-weight: 500;
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-type {
          font-family: var(--st-font-mono, monospace);
          font-size: 11px;
          white-space: nowrap;
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-note {
          color: var(--st-text-secondary);
          font-size: 11px;
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-value {
          font-family: var(--st-font-mono, monospace);
          font-size: 11px;
          max-width: 260px;
          overflow-wrap: anywhere;
          color: var(--st-text-secondary);
          margin: 0;
          white-space: pre-wrap;
        }
        :is(.\\32 0ui, .ui20).fields-showcase .fs-commit {
          color: var(--st-success, var(--st-text));
          font-size: 11px;
        }
        /* Minimal affordances for rc-* bits until the field CSS lands. */
        :is(.\\32 0ui, .ui20).fields-showcase .rc-chips,
        :is(.\\32 0ui, .ui20).fields-showcase .rc-chip,
        :is(.\\32 0ui, .ui20).fields-showcase .rc-actor,
        :is(.\\32 0ui, .ui20).fields-showcase .rc-file,
        :is(.\\32 0ui, .ui20).fields-showcase .rc-editor-row {
          display: inline-flex;
          align-items: center;
          gap: var(--st-space-1, 4px);
          flex-wrap: wrap;
        }
        :is(.\\32 0ui, .ui20).fields-showcase .rc-empty {
          color: var(--st-text-secondary);
        }
        :is(.\\32 0ui, .ui20).fields-showcase .rc-json {
          margin: 0;
          font-size: 11px;
          max-height: 80px;
          overflow: auto;
        }
      `}</style>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          RecordCell field-system showcase
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--st-font-size-sm)',
            color: 'var(--st-text-secondary)',
          }}
        >
          Every FieldType through the single <code>RecordCell</code> entry.
          Click Edit, change the value, commit (Enter / pick / blur) or cancel
          (Escape) — the committed value lands in the Value column.
        </p>
      </header>

      <table className="fs-table">
        <thead>
          <tr>
            <th style={{ width: 130 }}>Type</th>
            <th style={{ width: 220 }}>Display</th>
            <th style={{ width: 320 }}>Edit</th>
            <th>Value (stored)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const value = values[row.id];
            const isEditing = Boolean(editing[row.id]);
            return (
              <tr key={row.id}>
                <td>
                  <div className="fs-type">{row.field.type}</div>
                  {row.note ? <div className="fs-note">{row.note}</div> : null}
                </td>
                <td>
                  <RecordCell
                    field={row.field}
                    value={value}
                    relationResolver={relationResolver}
                  />
                </td>
                <td>
                  {row.field.system ? (
                    <span className="fs-note">
                      read-only — RecordCell forces the display view for
                      system fields even in edit mode
                    </span>
                  ) : isEditing ? (
                    <RecordCell
                      field={row.field}
                      value={value}
                      mode="edit"
                      relationResolver={relationResolver}
                      onCommit={(next) => {
                        setValues((v) => ({ ...v, [row.id]: next }));
                        setLog((l) => ({
                          ...l,
                          [row.id]: `committed ${new Date().toLocaleTimeString()}`,
                        }));
                        stopEditing(row.id);
                      }}
                      onCancel={() => {
                        setLog((l) => ({ ...l, [row.id]: 'cancelled' }));
                        stopEditing(row.id);
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--st-space-2)',
                      }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditing((e) => ({ ...e, [row.id]: true }))
                        }
                      >
                        Edit
                      </Button>
                      {log[row.id] ? (
                        <span className="fs-commit" aria-live="polite">
                          {log[row.id]}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td>
                  <pre className="fs-value">{JSON.stringify(value, null, 1) ?? 'undefined'}</pre>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
