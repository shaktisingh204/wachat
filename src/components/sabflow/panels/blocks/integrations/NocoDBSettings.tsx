'use client';

import { Database } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

/* ── Types ─────────────────────────────────────────────────── */

type NocoDBAction = 'insert_row' | 'list_rows' | 'update_row' | 'delete_row';

interface NocoDBOptions {
  apiUrl?: string;
  apiToken?: string;
  tableId?: string;
  action?: NocoDBAction;
}

const ACTIONS: { value: NocoDBAction; label: string }[] = [
  { value: 'insert_row', label: 'Insert Row' },
  { value: 'list_rows', label: 'List Rows' },
  { value: 'update_row', label: 'Update Row' },
  { value: 'delete_row', label: 'Delete Row' },
];

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Component ─────────────────────────────────────────────── */

export function NocoDBSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as NocoDBOptions;
  const action: NocoDBAction = opts.action ?? 'insert_row';

  const update = (patch: Partial<NocoDBOptions>) => {
    onBlockChange({ ...block, options: { ...opts, ...patch } });
  };

  return (
    <div className="space-y-4">
      <PageHeader compact>
        <PageHeaderHeading>
          <span className="inline-flex items-center gap-2">
            <Database size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
            <PageTitle>NocoDB</PageTitle>
          </span>
        </PageHeaderHeading>
      </PageHeader>

      <Field label="API URL">
        <Input
          type="url"
          value={opts.apiUrl ?? ''}
          onChange={(e) => update({ apiUrl: e.target.value })}
          placeholder="https://your-nocodb.com"
          spellCheck={false}
          aria-label="API URL"
        />
      </Field>

      <Field label="API Token">
        <Input
          type="text"
          value={opts.apiToken ?? ''}
          onChange={(e) => update({ apiToken: e.target.value })}
          placeholder="xc-auth-token or API token"
          spellCheck={false}
          autoComplete="off"
          aria-label="API token"
        />
      </Field>

      <Field label="Table ID">
        <Input
          type="text"
          value={opts.tableId ?? ''}
          onChange={(e) => update({ tableId: e.target.value })}
          placeholder="md_xxxxxxxxxxxxx"
          spellCheck={false}
          aria-label="Table ID"
        />
      </Field>

      <Field label="Action">
        <Select value={action} onValueChange={(v) => update({ action: v as NocoDBAction })}>
          <SelectTrigger aria-label="Action">
            <SelectValue placeholder="Select an action" />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
