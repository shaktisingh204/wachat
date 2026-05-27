'use client';

/**
 * ImportClient — single-page n8n + Typebot JSON importer.
 *
 * Two ways to provide the workflow:
 *   1. Drag-and-drop a .json file onto the drop zone
 *   2. Paste raw JSON into the text area
 *
 * Format auto-detection by inspecting top-level keys:
 *   - `{ nodes, connections }` → n8n
 *   - `{ groups, events }` or `{ groups }` → Typebot
 *
 * On success: redirect to the new flow's editor.  On failure: surface the
 * error inline so the user can edit the JSON and retry.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuArrowRight,
  LuCircleCheck,
  LuFileJson,
  LuLoader,
  LuTriangleAlert,
  LuUpload,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type Detection = 'n8n' | 'typebot' | 'unknown';

function detectFormat(input: unknown): Detection {
  if (!input || typeof input !== 'object') return 'unknown';
  const o = input as Record<string, unknown>;
  if (Array.isArray(o.nodes) && o.connections && typeof o.connections === 'object') {
    return 'n8n';
  }
  if (Array.isArray(o.groups)) return 'typebot';
  return 'unknown';
}

type ImportResponse = {
  flowId: string;
  name?: string;
  blocks?: number;
  triggers?: number;
  stubbed?: string[];
  warnings?: string[];
};

export function ImportClient() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    format: 'n8n' | 'typebot';
    response: ImportResponse;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError(`"${file.name}" doesn’t look like a JSON file.`);
      return;
    }
    try {
      const text = await file.text();
      setRaw(text);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file');
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const submit = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (!raw.trim()) {
      setError('Paste or upload a workflow.json first.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'parse failed'}`);
      return;
    }
    const format = detectFormat(parsed);
    if (format === 'unknown') {
      setError(
        'Could not detect format. Expected an n8n workflow (with "nodes" + "connections") or a Typebot export (with "groups").',
      );
      return;
    }

    const url =
      format === 'n8n'
        ? '/api/sabflow/import-n8n'
        : '/api/sabflow/import-typebot';

    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => ({}))) as
        | ImportResponse
        | { error?: string };
      if (!res.ok) {
        const msg =
          ('error' in json && json.error) ||
          `Import failed (${res.status})`;
        setError(msg);
        return;
      }
      setSuccess({ format, response: json as ImportResponse });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }, [raw]);

  const openFlow = useCallback(() => {
    if (success) router.push(`/dashboard/sabflow/flow-builder/${success.response.flowId}`);
  }, [router, success]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted">
          <LuUpload className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Import flow
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Bring an n8n workflow or a Typebot export into SabFlow.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging
              ? 'border-zoru-line bg-zoru-surface-2/40 dark:bg-zoru-ink/20'
              : 'border-[var(--gray-5)] bg-[var(--gray-2)]',
          )}
        >
          <LuFileJson className="h-7 w-7 text-[var(--gray-8)]" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-[var(--gray-11)]">
            Drop a <code>workflow.json</code> here, or
          </p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)]">
            <LuUpload className="h-3.5 w-3.5" />
            Choose file
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFileInput}
            />
          </label>
          <p className="mt-1 text-[10.5px] text-[var(--gray-9)]">
            Format detected automatically — n8n (nodes + connections) or Typebot (groups).
          </p>
        </div>

        {/* Paste area */}
        <div className="mt-4">
          <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)] mb-1.5">
            Or paste JSON
          </label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='{"nodes": [...], "connections": {...}}  or  {"groups": [...]}'
            spellCheck={false}
            rows={10}
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 font-mono text-[11.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-zoru-line resize-y"
          />
          <p className="mt-1 text-[10.5px] text-[var(--gray-9)] tabular-nums">
            {raw.length.toLocaleString()} chars
          </p>
        </div>

        {/* Submit */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !raw.trim()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white transition-colors',
              busy || !raw.trim()
                ? 'bg-[var(--gray-6)] cursor-not-allowed'
                : 'bg-zoru-ink hover:bg-zoru-ink',
            )}
          >
            {busy ? (
              <LuLoader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LuArrowRight className="h-3.5 w-3.5" />
            )}
            {busy ? 'Importing…' : 'Import'}
          </button>
          {raw.trim() && !busy && !success && (
            <span className="text-[11.5px] text-[var(--gray-9)]">
              We’ll auto-detect n8n vs Typebot from the JSON.
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[12px] text-zoru-ink">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-3 dark:border-zoru-line/50 dark:bg-zoru-ink/30">
            <div className="flex items-center gap-2">
              <LuCircleCheck className="h-4 w-4 text-zoru-ink dark:text-zoru-ink-muted" />
              <span className="text-[13px] font-semibold text-zoru-ink dark:text-zoru-ink-muted">
                Imported from {success.format === 'n8n' ? 'workflow JSON' : 'Typebot'}
              </span>
            </div>
            <ul className="text-[11.5px] text-zoru-ink dark:text-zoru-ink-muted ml-6 list-disc space-y-0.5">
              <li>
                Name:{' '}
                <strong className="font-semibold">
                  {success.response.name ?? '(unnamed)'}
                </strong>
              </li>
              {success.response.blocks !== undefined && (
                <li>
                  Blocks imported:{' '}
                  <strong>{success.response.blocks}</strong>
                </li>
              )}
              {success.response.triggers !== undefined && success.response.triggers > 0 && (
                <li>
                  Triggers:{' '}
                  <strong>{success.response.triggers}</strong>
                </li>
              )}
              {(success.response.stubbed?.length ?? 0) > 0 && (
                <li>
                  <strong>{success.response.stubbed!.length}</strong> node(s)
                  fell back to stubs — visit the editor to remap them.
                </li>
              )}
              {(success.response.warnings?.length ?? 0) > 0 && (
                <li>
                  <strong>{success.response.warnings!.length}</strong>{' '}
                  warning(s) — see the editor.
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={openFlow}
              className="mt-1 self-start inline-flex items-center gap-1.5 rounded-md bg-zoru-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-zoru-ink"
            >
              Open flow
              <LuArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
