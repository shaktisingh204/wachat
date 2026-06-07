'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload } from 'lucide-react';
import { Button, useToast } from '@/components/sabcrm/20ui';

/* Types */

type ImportResponse = { flowId: string };
type ErrorResponse = { error: string };

/* FlowImportExport */

/**
 * Renders an Import button (and optionally an Export button when `flowId` is
 * provided). Both are self-contained, no parent state required.
 *
 * Import: file picker, POST /api/sabflow/import, redirect to editor.
 * Export: GET /api/sabflow/export/[flowId], browser download.
 */
export function FlowImportExport({ flowId }: { flowId?: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* Export */
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

  /* Import */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected if needed.
    e.target.value = '';

    if (!file) return;

    /* Parse JSON */
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      toast({
        title: 'Invalid file',
        description: 'The selected file is not valid JSON.',
        tone: 'danger',
      });
      return;
    }

    /* Basic shape check */
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('flow' in parsed) ||
      typeof (parsed as Record<string, unknown>).flow !== 'object'
    ) {
      toast({
        title: 'Invalid flow file',
        description: 'File must contain a top-level `flow` object.',
        tone: 'danger',
      });
      return;
    }

    /* POST to import API */
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
          tone: 'danger',
        });
        return;
      }

      toast({ title: 'Flow imported', description: 'Redirecting to editor.', tone: 'success' });
      router.push(`/dashboard/sabflow/flow-builder/${data.flowId}`);
    } catch {
      toast({
        title: 'Import failed',
        description: 'Could not reach the server. Please try again.',
        tone: 'danger',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input, programmatic flow-JSON trigger */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Import button */}
      <Button
        variant="outline"
        size="sm"
        iconLeft={Upload}
        loading={importing}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Import flow from JSON file"
      >
        {importing ? 'Importing' : 'Import'}
      </Button>

      {/* Export button, only rendered when a flowId is supplied */}
      {flowId && (
        <Button
          variant="outline"
          size="sm"
          iconLeft={Download}
          onClick={handleExport}
          aria-label="Export flow as JSON file"
        >
          Export
        </Button>
      )}
    </div>
  );
}
