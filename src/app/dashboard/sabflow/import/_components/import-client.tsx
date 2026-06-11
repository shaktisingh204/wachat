'use client';

/**
 * ImportClient - single-page n8n + Typebot JSON importer.
 *
 * Two ways to provide the workflow:
 *   1. Pick a .json file from SabFiles (library or fresh upload)
 *   2. Paste raw JSON into the text area
 *
 * Format auto-detection by inspecting top-level keys:
 *   - `{ nodes, connections }` -> n8n
 *   - `{ groups, events }` or `{ groups }` -> Typebot
 *
 * On success: surface a summary + an "Open flow" action.  On failure: surface
 * the error inline so the user can edit the JSON and retry.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  FileJson,
  Upload,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Textarea,
  Alert,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';

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
  const { toast } = useToast();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    format: 'n8n' | 'typebot';
    response: ImportResponse;
  } | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        const msg = `"${file.name}" does not look like a JSON file.`;
        setError(msg);
        toast.error(msg);
        return;
      }
      try {
        const text = await file.text();
        setRaw(text);
        setError(null);
        toast.success(`Loaded ${file.name}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to read file';
        setError(msg);
        toast.error(msg);
      }
    },
    [toast],
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
        toast.error(msg);
        return;
      }
      setSuccess({ format, response: json as ImportResponse });
      toast.success('Workflow imported');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [raw, toast]);

  const openFlow = useCallback(() => {
    if (success) router.push(`/dashboard/sabflow/flow-builder/${success.response.flowId}`);
  }, [router, success]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Import flow</PageTitle>
          <PageDescription>
            Bring an n8n workflow or a Typebot export into SabFlow.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full">
        {/* File picker */}
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
              aria-hidden="true"
            >
              <FileJson className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <p className="text-sm font-medium text-[var(--st-text)]">
              Pick a <code>workflow.json</code> from SabFiles
            </p>
            <SabFileToFileButton
              accept="all"
              variant="outline"
              title="Pick a workflow.json"
              onPickFile={(file) => handleFile(file)}
              onError={(err) => {
                setError(err.message);
                toast.error(err.message);
              }}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose file
            </SabFileToFileButton>
            <p className="text-xs text-[var(--st-text-tertiary)]">
              Format detected automatically. n8n (nodes + connections) or Typebot (groups).
            </p>
          </div>
        </Card>

        {/* Paste area */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Or paste JSON</CardTitle>
          </CardHeader>
          <CardBody>
            <Field help={`${raw.length.toLocaleString()} chars`}>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={'{"nodes": [...], "connections": {...}}  or  {"groups": [...]}'}
                spellCheck={false}
                rows={10}
                className="font-mono text-xs resize-y"
              />
            </Field>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={submit}
                disabled={busy || !raw.trim()}
                loading={busy}
                iconLeft={ArrowRight}
              >
                {busy ? 'Importing' : 'Import'}
              </Button>
              {raw.trim() && !busy && !success && (
                <span className="text-xs text-[var(--st-text-secondary)]">
                  We auto-detect n8n vs Typebot from the JSON.
                </span>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Error */}
        {error && (
          <Alert tone="danger" title="Import error" className="mt-4">
            {error}
          </Alert>
        )}

        {/* Success */}
        {success && (
          <Card className="mt-4">
            <CardHeader className="flex flex-wrap items-center gap-2">
              <CheckCircle2
                className="h-4 w-4 text-[var(--st-status-ok)]"
                aria-hidden="true"
              />
              <CardTitle>
                Imported from {success.format === 'n8n' ? 'workflow JSON' : 'Typebot'}
              </CardTitle>
              <Badge tone="success" kind="soft">
                {success.format === 'n8n' ? 'n8n' : 'Typebot'}
              </Badge>
            </CardHeader>
            <CardBody>
              <ul className="ml-5 list-disc space-y-1 text-xs text-[var(--st-text-secondary)]">
                <li>
                  Name:{' '}
                  <strong className="font-semibold text-[var(--st-text)]">
                    {success.response.name ?? '(unnamed)'}
                  </strong>
                </li>
                {success.response.blocks !== undefined && (
                  <li>
                    Blocks imported:{' '}
                    <strong className="text-[var(--st-text)]">{success.response.blocks}</strong>
                  </li>
                )}
                {success.response.triggers !== undefined && success.response.triggers > 0 && (
                  <li>
                    Triggers:{' '}
                    <strong className="text-[var(--st-text)]">{success.response.triggers}</strong>
                  </li>
                )}
                {(success.response.stubbed?.length ?? 0) > 0 && (
                  <li>
                    <strong className="text-[var(--st-text)]">
                      {success.response.stubbed!.length}
                    </strong>{' '}
                    node(s) fell back to stubs. Visit the editor to remap them.
                  </li>
                )}
                {(success.response.warnings?.length ?? 0) > 0 && (
                  <li>
                    <strong className="text-[var(--st-text)]">
                      {success.response.warnings!.length}
                    </strong>{' '}
                    warning(s). See the editor.
                  </li>
                )}
              </ul>
              <div className="mt-3">
                <Button variant="primary" onClick={openFlow} iconRight={ArrowRight}>
                  Open flow
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
