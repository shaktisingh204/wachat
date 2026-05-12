'use client';

/**
 * Client side of the Holidays list — owns the year/type filters, the
 * table, and the hard-delete confirmation dialog. Filters are written
 * straight to the URL so the server component re-fetches.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Trash2,
  LoaderCircle,
  CalendarDays,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { deleteHolidayAction } from '@/app/actions/crm/holidays.actions';
import type {
  CrmHolidayDoc,
  CrmHolidayType,
} from '@/lib/rust-client/crm-holidays';

interface HolidayListClientProps {
  holidays: CrmHolidayDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialYear: string;
  initialType: string;
  error?: string;
}

const TYPE_OPTIONS: { value: CrmHolidayType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'national', label: 'National' },
  { value: 'regional', label: 'Regional' },
  { value: 'religious', label: 'Religious' },
  { value: 'optional', label: 'Optional' },
  { value: 'restricted', label: 'Restricted' },
];

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
}

function looksLikeObjectId(v?: string): boolean {
  return !!v && /^[0-9a-fA-F]{24}$/.test(v);
}

export function HolidayListClient({
  holidays,
  page,
  limit,
  hasMore,
  initialYear,
  initialType,
  error,
}: HolidayListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [yearInput, setYearInput] = React.useState(initialYear);
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmHolidayDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  // Debounce year filter → URL.
  React.useEffect(() => {
    if (yearInput === initialYear) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      const trimmed = yearInput.trim();
      if (trimmed && /^\d{4}$/.test(trimmed)) params.set('year', trimmed);
      else params.delete('year');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 350);
    return () => clearTimeout(t);
  }, [yearInput, initialYear, sp, pathname, router]);

  const setTypeFilter = (next: string) => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (next && next !== 'all') params.set('holidayType', next);
    else params.delete('holidayType');
    params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const name = pendingDelete.name;
    startDelete(async () => {
      const res = await deleteHolidayAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${name} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <ZoruInput
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              placeholder="Year (e.g. 2026)"
              inputMode="numeric"
              maxLength={4}
              className="h-9 w-[160px] text-[13px]"
            />
          </div>
          <ZoruSelect
            value={initialType || 'all'}
            onValueChange={setTypeFilter}
          >
            <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
              <ZoruSelectValue placeholder="All types" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <ZoruSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead>Type</ZoruTableHead>
            <ZoruTableHead>Country</ZoruTableHead>
            <ZoruTableHead>Recurring</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {holidays.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={6}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                <div className="flex flex-col items-center gap-1">
                  <CalendarDays className="h-5 w-5 text-zoru-ink-muted" />
                  {initialYear || initialType
                    ? 'No holidays match these filters.'
                    : 'No holidays yet — click "New holiday" to add one.'}
                </div>
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            holidays.map((h) => {
              const id = String(h._id);
              const countryId =
                h.applicableLocations?.find((l) => looksLikeObjectId(l)) ??
                null;
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/hr-payroll/holidays/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {h.name}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {fmtDate(h.date)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {h.holidayType ? (
                      <ZoruBadge variant="outline" className="capitalize">
                        {h.holidayType}
                      </ZoruBadge>
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">
                        —
                      </span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {countryId ? (
                      <EntityPickerChip entity="country" id={countryId} />
                    ) : (
                      '—'
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {h.recurring ? (
                      <ZoruBadge variant="outline">Yearly</ZoruBadge>
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">
                        One-off
                      </span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/holidays/${id}/edit`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(h)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete holiday?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{' '}
              <strong>{pendingDelete?.name ?? ''}</strong> from the
              database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
