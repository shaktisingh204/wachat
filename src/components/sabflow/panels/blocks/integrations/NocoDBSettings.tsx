'use client';

import { LuDatabase } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass } from '../shared/primitives';

/* ── Types ─────────────────────────────────────────────────── */

type NocoDBAction = 'insert_row' | 'list_rows' | 'update_row' | 'delete_row';

interface NocoDBOptions {
  apiUrl?: string;
  apiToken?: string;
  tableId?: string;
  action?: NocoDBAction;
}

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Component ─────────────────────────────────────────────── */

export function NocoDBSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as NocoDBOptions;

  const update = (patch: Partial<NocoDBOptions>) => {
    onBlockChange({ ...block, options: { ...opts, ...patch } });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuDatabase} title="NocoDB" />

      <Field label="API URL">
        <input
          type="url"
          value={opts.apiUrl ?? ''}
          onChange={(e) => update({ apiUrl: e.target.value })}
          placeholder="https://your-nocodb.com"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="API Token">
        <input
          type="text"
          value={opts.apiToken ?? ''}
          onChange={(e) => update({ apiToken: e.target.value })}
          placeholder="xc-auth-token or API token"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="Table ID">
        <input
          type="text"
          value={opts.tableId ?? ''}
          onChange={(e) => update({ tableId: e.target.value })}
          placeholder="md_xxxxxxxxxxxxx"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="Action">
        <select
          value={opts.action ?? 'insert_row'}
          onChange={(e) => update({ action: e.target.value as NocoDBAction })}
          className={selectClass}
        >
          <option value="insert_row">Insert Row</option>
          <option value="list_rows">List Rows</option>
          <option value="update_row">Update Row</option>
          <option value="delete_row">Delete Row</option>
        </select>
      </Field>
    </div>
  );
}
