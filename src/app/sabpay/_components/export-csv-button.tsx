'use client';

import * as React from 'react';
import { Download } from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';

export interface ExportCsvButtonProps {
  /** Builds the CSV (usually a server action). Return `error` to abort with a toast. */
  onExport: () => Promise<{ csv?: string; filename?: string; error?: string }>;
  /** Fallback download name when `onExport` doesn't return one. */
  filename?: string;
  label?: string;
}

/**
 * "Export" button for SabPay list pages. Calls `onExport()`, then downloads
 * the returned CSV purely client-side via a Blob + temporary object URL —
 * nothing is ever written to disk on the server.
 */
export function ExportCsvButton({
  onExport,
  filename = 'export.csv',
  label = 'Export',
}: ExportCsvButtonProps): React.JSX.Element {
  const [exporting, setExporting] = React.useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await onExport();
      if (result.error || !result.csv) {
        toast({
          title: 'Export failed',
          description: result.error || 'There was nothing to export.',
          tone: 'danger',
        });
        return;
      }
      const name = result.filename || filename;
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: `Downloaded ${name}.`, tone: 'success' });
    } catch {
      toast({
        title: 'Export failed',
        description: 'Something went wrong while exporting.',
        tone: 'danger',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      variant="secondary"
      iconLeft={<Download size={15} />}
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? 'Exporting…' : label}
    </Button>
  );
}
