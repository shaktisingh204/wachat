'use client';

/**
 * SabCRM — Form submissions client (`/sabcrm/forms/[formId]/submissions`).
 *
 * Renders one form's submissions as a 20ui table:
 *   - columns follow the form's field order (capped for readability);
 *   - per-row "Convert" creates a record on the form's target object via
 *     `convertSabcrmSubmissionToRecord` (mapping = field `mapping` ?? key)
 *     and flips the row to `processed`;
 *   - "Export CSV" pulls the FULL submission set server-side
 *     (`exportSabcrmFormSubmissionsCsv`) and downloads it as a file.
 *
 * Data flows down from the server page; after a conversion the action
 * revalidates the route and the client calls `router.refresh()`.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Inbox, UserPlus } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

import {
  convertSabcrmSubmissionToRecord,
  exportSabcrmFormSubmissionsCsv,
} from '@/app/actions/sabcrm-forms.actions';
import type { SabcrmFormSubmissionRow } from '@/app/actions/sabcrm-forms.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Types + display helpers
// ---------------------------------------------------------------------------

/** One data column (a form field) the table renders. */
export interface SubmissionColumn {
  key: string;
  label: string;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  new: 'info',
  processed: 'success',
  spam: 'warning',
  archived: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  processed: 'Processed',
  spam: 'Spam',
  archived: 'Archived',
};

/** Keep the table readable — extra fields are still in the CSV export. */
const MAX_DATA_COLUMNS = 5;

/** `2026-06-11T09:30:00Z` → `11 Jun 2026, 09:30` (UTC, deterministic). */
function formatDateTime(iso: string): string {
  const day = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return iso || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}${time ? `, ${time}` : ''}`;
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export interface SubmissionsClientProps {
  formId: string;
  formName: string;
  /** Object slug conversions create records under (e.g. `leads`). */
  targetObject: string;
  columns: SubmissionColumn[];
  initialRows: SabcrmFormSubmissionRow[];
  /** Non-null when a fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

export function SubmissionsClient({
  formId,
  formName,
  targetObject,
  columns,
  initialRows,
  initialError,
}: SubmissionsClientProps): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [convertingId, setConvertingId] = React.useState<string | null>(null);
  const [, startConvert] = React.useTransition();
  const [exporting, startExport] = React.useTransition();

  const visibleColumns = columns.slice(0, MAX_DATA_COLUMNS);

  const handleConvert = (row: SabcrmFormSubmissionRow): void => {
    setError(null);
    setConvertingId(row.id);
    startConvert(async () => {
      const res = await convertSabcrmSubmissionToRecord(row.id);
      setConvertingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const handleExport = (): void => {
    setError(null);
    startExport(async () => {
      const res = await exportSabcrmFormSubmissionsCsv(formId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formName.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'form'}-submissions.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };

  const convertLabel =
    targetObject === 'leads' ? 'Convert to lead' : `Convert to ${targetObject}`;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pb-12 pt-6">
      <div className="mb-2">
        <Link
          href="/sabcrm/forms"
          className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] underline-offset-2 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Forms
        </Link>
      </div>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{formName} — submissions</PageTitle>
          <PageDescription>
            Everything visitors submitted through this form. Convert rows
            into {targetObject} records or export the full set as CSV.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={Download}
            loading={exporting}
            onClick={handleExport}
            disabled={initialRows.length === 0}
          >
            Export CSV
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load submissions: {initialError}
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Inbox}
            title="No submissions yet"
            description="Share the form's public link — new submissions appear here."
          />
        </div>
      ) : null}

      {initialRows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th>Submitted</Th>
                {visibleColumns.map((col) => (
                  <Th key={col.key}>{col.label}</Th>
                ))}
                <Th>Status</Th>
                <Th align="right" width={170}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  <Td>{formatDateTime(row.createdAt)}</Td>
                  {visibleColumns.map((col) => (
                    <Td
                      key={col.key}
                      truncate
                      title={row.values[col.key] || undefined}
                    >
                      {row.values[col.key] || '—'}
                    </Td>
                  ))}
                  <Td>
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={UserPlus}
                      loading={convertingId === row.id}
                      disabled={
                        row.status === 'processed' ||
                        (convertingId !== null && convertingId !== row.id)
                      }
                      aria-label={`${convertLabel} for submission from ${formatDateTime(row.createdAt)}`}
                      onClick={() => handleConvert(row)}
                    >
                      {row.status === 'processed' ? 'Converted' : convertLabel}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
