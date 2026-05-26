'use client';

/**
 * Bulk send. Pick a template, upload a CSV with one signer per row,
 * spawn N envelopes — one per CSV row — and track them under a batch id.
 *
 * CSV columns (case-insensitive headers): `name`, `email`, `phone`,
 * `role`. Extra columns are ignored.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload } from 'lucide-react';

import {
  Button,
  Card,
  Input,
  Label,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  bulkSendFromTemplate,
  listTemplates,
} from '@/app/actions/sabsign.actions';
import type { EsignTemplateDoc } from '@/lib/rust-client/esign-templates';

interface ParsedRow {
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const nI = idx('name');
  const eI = idx('email');
  const pI = idx('phone');
  const rI = idx('role');
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim());
    if (nI < 0 || eI < 0) continue;
    if (!cells[nI] || !cells[eI]) continue;
    rows.push({
      name: cells[nI],
      email: cells[eI],
      phone: pI >= 0 ? cells[pI] : undefined,
      role: rI >= 0 ? cells[rI] : undefined,
    });
  }
  return rows;
}

export default function BulkSendPage() {
  const router = useRouter();
  const [templates, setTemplates] = React.useState<EsignTemplateDoc[]>([]);
  const [templateId, setTemplateId] = React.useState('');
  const [prefix, setPrefix] = React.useState('Envelope');
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [csvName, setCsvName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    listTemplates({ limit: 100 }).then((r) => setTemplates(r.items));
  }, []);

  const onPickCsv = async (pick: { url: string; name: string }) => {
    setCsvName(pick.name);
    const res = await fetch(pick.url);
    const text = await res.text();
    setRows(parseCsv(text));
  };

  const submit = async () => {
    if (!templateId || rows.length === 0) return;
    setBusy(true);
    try {
      const res = await bulkSendFromTemplate(templateId, rows, prefix.trim() || 'Envelope');
      alert(`Spawned ${res.envelopeIds.length} envelopes (batch ${res.batchId}).`);
      router.push(`/dashboard/sabsign?bulkBatchId=${res.batchId}`);
    } catch (err) {
      console.error(err);
      alert(`Bulk send failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/sabsign">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-zoru-ink">Bulk send</h1>
      </div>
      <Card className="p-4 border border-zoru-line space-y-3">
        <div>
          <Label>Template</Label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full h-10 rounded-md border border-zoru-line bg-zoru-bg px-3 text-sm"
          >
            <option value="">— pick a template —</option>
            {templates.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Envelope name prefix</Label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <div>
          <Label>Signers CSV</Label>
          <p className="text-xs text-zoru-ink-muted mb-2">
            Headers: <code>name,email,phone,role</code>. One envelope is spawned per row.
          </p>
          <SabFilePickerButton accept="document" onPick={onPickCsv}>
            {csvName || 'Pick CSV from SabFiles'}
          </SabFilePickerButton>
          {rows.length > 0 && (
            <div className="text-xs text-zoru-ink-muted mt-2">
              Parsed {rows.length} row{rows.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>
        <Button
          disabled={!templateId || rows.length === 0 || busy}
          onClick={submit}
        >
          <Upload className="h-4 w-4 mr-2" />
          Spawn {rows.length || 0} envelope{rows.length === 1 ? '' : 's'}
        </Button>
      </Card>
    </div>
  );
}
