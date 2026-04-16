'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LuDownload, LuUpload, LuLoader } from 'react-icons/lu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────────── */

type ImportResponse = { flowId: string };
type ErrorResponse = { error: string };

/* ── FlowImportExport ───────────────────────────────────────────────────── */

/**
 * Renders an Import button (and optionally an Export button when `flowId` is
 * provided).  Both are self-contained — no parent state required.
 *
 * Import: file picker → POST /api/sabflow/import → redirect to editor
 * Export: GET /api/sabflow/export/[flowId]       → browser download
 */
export function FlowImportExport({ flowId }: { flowId?: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* ── Export ─────────────────────────────────────────────────────────── */
  const handleExport = () => {
    if (!flowId) return;
    // Trigger a browser download by pointing a hidden anchor at the export API.
    const a = document.createElement('a');
    a.href = `/api/sabflow/export/${flowId}`;
    a.download = `flow-${flowId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ── Import ─────────────────────────────────────────────────────────── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected if needed.
    e.target.value = '';

    if (!file) return;

    /* Parse JSON ──────────────────────────────────────────────────────── */
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      toast({
        title: 'Invalid file',
        description: 'The selected file is not valid JSON.',
        variant: 'destructive',
      });
      return;
    }

    /* Basic shape check ───────────────────────────────────────────────── */
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('flow' in parsed) ||
      typeof (parsed as Record<string, unknown>).flow !== 'object'
    ) {
      toast({
        title: 'Invalid flow file',
        description: 'File must contain a top-level `flow` object.',
        variant: 'destructive',
      });
      return;
    }

    /* POST to import API ──────────────────────────────────────────────── */
    setImporting(true);
    try {
      const res = await fetch('/api/sabflow/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = (await res.json()) as ImportResponse | ErrorResponse;

      if (!res.ok || 'error' in data) {
        toast({
          title: 'Import failed',
          description: 'error' in data ? data.error : 'Unknown error',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Flow imported', description: 'Redirecting to editor…' });
      router.push(`/dashboard/sabflow/flow-builder/${data.flowId}`);
    } catch {
      toast({
        title: 'Import failed',
        description: 'Could not reach the server. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Import button */}
      <button
        type="button"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
          'border border-zinc-200 dark:border-zinc-700',
          'bg-white dark:bg-zinc-800',
          'text-zinc-700 dark:text-zinc-300',
          'hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        aria-label="Import flow from JSON file"
      >
        {importing ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LuUpload className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        <span>{importing ? 'Importing…' : 'Import'}</span>
      </button>

      {/* Export button — only rendered when a flowId is supplied */}
      {flowId && (
        <button
          type="button"
          onClick={handleExport}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
            'border border-zinc-200 dark:border-zinc-700',
            'bg-white dark:bg-zinc-800',
            'text-zinc-700 dark:text-zinc-300',
            'hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600',
          )}
          aria-label="Export flow as JSON file"
        >
          <LuDownload className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Export</span>
        </button>
      )}
    </div>
  );
}
