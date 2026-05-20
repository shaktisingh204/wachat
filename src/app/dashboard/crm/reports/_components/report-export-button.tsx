'use client';

import * as React from 'react';
import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import { Download } from 'lucide-react';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

export interface ReportExportButtonProps {
  filename: string;
  headers: string[];
  rows: ExportRow[];
  sheetName?: string;
  disabled?: boolean;
}

/**
 * <ReportExportButton /> — small CSV/XLSX export menu used by HR / people
 * report pages. Renders a dropdown with two items: Export CSV / Export XLSX.
 *
 * Kept as its own client island so the page can remain a server component
 * and the heavy `xlsx` lib is only loaded when the menu item is invoked.
 */
export function ReportExportButton({
  filename,
  headers,
  rows,
  sheetName,
  disabled,
}: ReportExportButtonProps) {
  const onCsv = React.useCallback(() => {
    downloadCsv(`${filename}-${dateStamp()}.csv`, headers, rows);
  }, [filename, headers, rows]);

  const onXlsx = React.useCallback(() => {
    void downloadXlsx(
      `${filename}-${dateStamp()}.xlsx`,
      headers,
      rows,
      sheetName ?? filename,
    );
  }, [filename, headers, rows, sheetName]);

  return (
    <ZoruDropdownMenu>
      <ZoruDropdownMenuTrigger asChild>
        <ZoruButton
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || rows.length === 0}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </ZoruButton>
      </ZoruDropdownMenuTrigger>
      <ZoruDropdownMenuContent align="end">
        <ZoruDropdownMenuItem onSelect={onCsv}>Export CSV</ZoruDropdownMenuItem>
        <ZoruDropdownMenuItem onSelect={onXlsx}>
          Export XLSX
        </ZoruDropdownMenuItem>
      </ZoruDropdownMenuContent>
    </ZoruDropdownMenu>
  );
}
