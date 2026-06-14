'use client';

import * as React from 'react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { Send, FileSpreadsheet, Upload, Loader2, CheckCircle2 } from 'lucide-react';

import { bulkSendFromTemplate } from '@/app/actions/sabsign.actions';

interface TemplateOpt {
  id: string;
  name: string;
  roles: string[];
}

interface BulkRow {
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

const COL_ALIASES: Record<keyof BulkRow, string[]> = {
  name: ['name', 'full name', 'fullname', 'signer', 'recipient'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  phone: ['phone', 'mobile', 'phone number', 'tel'],
  role: ['role', 'signer role', 'type'],
};

function pick(obj: Record<string, string>, key: keyof BulkRow): string | undefined {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) lower[k.trim().toLowerCase()] = v;
  for (const alias of COL_ALIASES[key]) {
    if (lower[alias] != null && String(lower[alias]).trim() !== '') {
      return String(lower[alias]).trim();
    }
  }
  return undefined;
}

function toRow(obj: Record<string, string>): BulkRow | null {
  const email = pick(obj, 'email');
  if (!email) return null;
  return {
    name: pick(obj, 'name') || email.split('@')[0],
    email,
    phone: pick(obj, 'phone'),
    role: pick(obj, 'role'),
  };
}

async function parseFile(file: File): Promise<BulkRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return [];
    let headers: string[] = [];
    const rows: BulkRow[] = [];
    ws.eachRow((row, n) => {
      const vals = ((row.values as unknown[]) ?? [])
        .slice(1)
        .map((v) => (v == null ? '' : String(v)).trim());
      if (n === 1) {
        headers = vals.map((h) => h.toLowerCase());
        return;
      }
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = vals[i] ?? ''));
      const r = toRow(obj);
      if (r) rows.push(r);
    });
    return rows;
  }
  // CSV
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data.map(toRow).filter((r): r is BulkRow => r != null);
}

export function BulkClient({ templates }: { templates: TemplateOpt[] }) {
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? '');
  const [prefix, setPrefix] = React.useState('Envelope');
  const [rows, setRows] = React.useState<BulkRow[]>([]);
  const [fileName, setFileName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ batchId: string; count: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) {
        setError('No rows with an email column were found.');
        setRows([]);
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError((err as Error).message || 'Could not parse the file.');
    }
  }

  async function send() {
    if (!templateId || !rows.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await bulkSendFromTemplate(templateId, rows, prefix || 'Envelope');
      setResult({ batchId: res.batchId, count: res.envelopeIds.length });
    } catch (err) {
      setError((err as Error).message || 'Bulk send failed.');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full rounded-[var(--st-radius,8px)] border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] px-3 py-2 text-sm text-[var(--st-text,#111)] outline-none focus:border-[var(--st-accent,#7c3aed)]';

  return (
    <main className="flex w-full max-w-4xl flex-col gap-5 p-1">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary,#999)]">
          SabSign
        </p>
        <h1 className="text-xl font-semibold text-[var(--st-text,#111)]">Bulk send</h1>
        <p className="text-sm text-[var(--st-text-secondary,#666)]">
          Pick a template, import a CSV or XLSX of recipients, and generate a
          personalised envelope for every row.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--st-border,#e5e5e5)] p-6 text-center text-sm text-[var(--st-text-secondary,#666)]">
          Create a template first — bulk send needs a template with signer roles.
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--st-text,#111)]">
              Template
            </span>
            <select
              className={inputCls}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--st-text,#111)]">
              Envelope name prefix
            </span>
            <input
              className={inputCls}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Envelope"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm font-medium text-[var(--st-text,#111)]">
              Recipients (.csv / .xlsx)
            </span>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--st-border,#e5e5e5)] px-3 py-3 text-sm text-[var(--st-text-secondary,#666)] hover:border-[var(--st-accent,#7c3aed)]">
              <Upload className="h-4 w-4" />
              <span>{fileName || 'Choose a CSV or XLSX file…'}</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                className="hidden"
                onChange={onFile}
              />
            </label>
            <p className="mt-1 text-xs text-[var(--st-text-tertiary,#999)]">
              Columns: <code>name</code>, <code>email</code> (required),{' '}
              <code>phone</code>, <code>role</code>.
            </p>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-[var(--st-border,#e5e5e5)]">
              <div className="flex items-center gap-2 bg-[var(--st-bg-secondary,#fafafa)] px-3 py-2 text-xs font-medium text-[var(--st-text-secondary,#666)]">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {rows.length} recipient{rows.length === 1 ? '' : 's'} ready
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-[var(--st-text-tertiary,#999)]">
                    <tr>
                      <th className="px-3 py-1.5">Name</th>
                      <th className="px-3 py-1.5">Email</th>
                      <th className="px-3 py-1.5">Phone</th>
                      <th className="px-3 py-1.5">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-[var(--st-border,#eee)]">
                        <td className="px-3 py-1.5 text-[var(--st-text,#111)]">{r.name}</td>
                        <td className="px-3 py-1.5 text-[var(--st-text,#111)]">{r.email}</td>
                        <td className="px-3 py-1.5 text-[var(--st-text-secondary,#666)]">
                          {r.phone || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--st-text-secondary,#666)]">
                          {r.role || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-[var(--st-status-danger,#dc2626)]">{error}</p>
          ) : null}

          {result ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Sent {result.count} envelope{result.count === 1 ? '' : 's'} (batch{' '}
              {result.batchId}).
            </div>
          ) : null}

          <button
            type="button"
            onClick={send}
            disabled={busy || !templateId || rows.length === 0}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--st-accent,#7c3aed)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'Sending…' : `Send ${rows.length || ''} envelope${rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </main>
  );
}
