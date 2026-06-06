'use client';

/**
 * SabCRM — export button.
 *
 * A simple button that exports records for a given object to CSV or XLSX format.
 * Calls `exportRecordsAction` and delegates to `downloadCsv` / `downloadXlsx`
 * on the client for file generation and download.
 *
 * The component handles loading, error states, and supports both CSV and XLSX
 * output formats. Respects the object's field metadata to determine which fields
 * to export.
 */

import * as React from 'react';
import { FileDown, Loader2, ChevronDown } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger as DropdownMenuTriggerPrimitive, useToast } from '@/components/sabcrm/20ui';
import { exportRecordsAction } from '@/app/actions/sabcrm.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import type { ExportRecordsResult } from '@/lib/sabcrm/import-export.server';

export interface ExportButtonProps {
  /** The object to export records from (e.g. `"companies"`, `"opportunities"`). */
  object: ObjectMetadata;
  /** Optional ordered list of field keys to include in export. Defaults to all non-relation/file fields. */
  fields?: string[];
  /** Maximum rows to export. Capped at 10,000 by the server; defaults to 1,000. */
  limit?: number;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Button size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional CSS class to apply to the button. */
  className?: string;
}

/** Exports records to CSV or XLSX and triggers download. */
export function ExportButton({
  object,
  fields,
  limit,
  projectId,
  size = 'md',
  className,
}: ExportButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleExport = React.useCallback(
    async (format: 'csv' | 'xlsx') => {
      setIsLoading(true);
      try {
        const result = await exportRecordsAction(
          {
            object: object.slug,
            fields,
            limit,
          },
          projectId,
        );

        if (!result.ok) {
          toast({
            title: 'Export failed',
            description: result.error || 'Unable to export records.',
            variant: 'destructive',
          });
          return;
        }

        const data = result.data as ExportRecordsResult;
        const filename = `${object.slug}-${dateStamp()}.${format}`;

        if (format === 'csv') {
          downloadCsv(filename, data.headers, data.rows);
        } else {
          await downloadXlsx(filename, data.headers, data.rows, object.labelPlural);
        }

        toast({
          title: 'Export successful',
          description: `Downloaded ${data.rows.length} ${object.labelPlural.toLowerCase()}.`,
        });
      } catch (error) {
        toast({
          title: 'Export error',
          description:
            error instanceof Error ? error.message : 'An unexpected error occurred.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [object, fields, limit, projectId, toast],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTriggerPrimitive asChild>
        <Button
          variant="outline"
          size={size}
          disabled={isLoading}
          className={className}
          leading={isLoading ? <Loader2 className="animate-spin" /> : <FileDown />}
          trailing={<ChevronDown />}
        >
          {isLoading ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTriggerPrimitive>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => handleExport('csv')}
          disabled={isLoading}
        >
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => handleExport('xlsx')}
          disabled={isLoading}
        >
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
