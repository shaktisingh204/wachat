'use client';

/**
 * SabCRM Finance — Proforma invoices list client
 * (`/sabcrm/finance/proforma-invoices`).
 *
 * Doc-surface-kit adopter (finance-rollout spec §3.3): KPI strip
 * (outstanding value / drafts / converted this month / avg days to
 * issue), config-driven list (typed columns, search + status + customer
 * + date-range filters, exact server pagination via the crm-common
 * envelope, bulk actions, CSV export) and the full DocForm drawer
 * (legacy line mapping, newline-split terms, G3 advance fields).
 *
 * Every row is display-ready: customers render as RESOLVED labels —
 * never a raw ObjectId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  FileClock,
  IndianRupee,
  Plus,
  Repeat,
  Send,
  Trash2,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  PROFORMA_STATUSES,
  proformaDetailHref,
  toProformaFilters,
} from './proforma-config';
import {
  buildProformaFormConfig,
  parseOptionalNumber,
  readProformaExtras,
} from './proforma-form';

import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  createSabcrmProformaFull,
  exportSabcrmProformaRows,
  listSabcrmProformaPage,
  transitionSabcrmProformaStatus,
} from '@/app/actions/sabcrm-finance-proforma.actions';
import { deleteSabcrmProformaInvoice } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmProformaKpis,
  SabcrmProformaListRow,
} from '@/app/actions/sabcrm-finance-proforma.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmProformaListRow>[] = [
  {
    key: 'proformaNumber',
    header: 'Number',
    kind: 'text',
    value: (r) => r.proformaNumber,
  },
  {
    key: 'party',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.partyLabel,
  },
  {
    key: 'proformaDate',
    header: 'Date',
    kind: 'date',
    value: (r) => r.proformaDate,
  },
  {
    key: 'validTillDate',
    header: 'Valid till',
    kind: 'date',
    value: (r) => r.validTillDate ?? undefined,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
  {
    key: 'total',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
  {
    key: 'advanceAmount',
    header: 'Advance ask',
    kind: 'money',
    value: (r) => r.advanceAmount ?? 0,
    currency: (r) => r.currency,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface ProformaInvoicesClientProps {
  initialRows: SabcrmProformaListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmProformaKpis | null;
}

export function ProformaInvoicesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: ProformaInvoicesClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmProformaListRow>>(
    () => ({
      title: 'Proforma invoices',
      description:
        'Pre-invoice asks and advance-payment requests — issue, track and convert into tax invoices.',
      icon: FileClock,
      entity: { singular: 'proforma invoice', plural: 'proforma invoices' },
      columns: COLUMNS,
      statuses: PROFORMA_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmProformaPage(toProformaFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmProformaRows(toProformaFilters(filters)),
      csvFileName: 'proforma-invoices.csv',
      rowHref: (row) => proformaDetailHref(row.id),
      rowLabel: (row) => `proforma invoice ${row.proformaNumber}`,
      partyFilter: {
        placeholder: 'Any customer',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'issue',
          label: 'Issue',
          icon: Send,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'Draft');
            if (drafts.length === 0) {
              return {
                ok: false,
                error: 'Only draft proforma invoices can be issued.',
              };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmProformaStatus(
                row.id,
                'Issued',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Archive',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected proforma invoices?',
            description:
              'Archived proforma invoices are hidden from the list (crm-common soft delete).',
            actionLabel: 'Archive proforma invoices',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmProformaInvoice(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const formConfig = React.useMemo(
    () => buildProformaFormConfig({ withIssue: true }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Outstanding value"
        icon={IndianRupee}
        value={formatDocMoney(kpis.outstandingValue, kpis.currency)}
        delta={`${kpis.issuedCount} issued ${kpis.issuedCount === 1 ? 'proforma' : 'proformas'}`}
        deltaTone={kpis.outstandingValue > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Drafts"
        icon={FileClock}
        value={String(kpis.draftCount)}
        delta="Awaiting issue"
        deltaTone={kpis.draftCount > 0 ? 'neutral' : 'up'}
      />
      <KpiCard
        label="Converted this month"
        icon={Repeat}
        value={String(kpis.convertedThisMonth)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} proformas`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'proforma' : 'proformas'}`
        }
        deltaTone={kpis.convertedThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Avg days to issue"
        icon={CalendarClock}
        value={kpis.avgDaysToIssue === null ? '—' : String(kpis.avgDaysToIssue)}
        delta="Draft → issued (approx.)"
      />
    </>
  ) : null;

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setFormOpen(true)}
          >
            New proforma
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <DocForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        config={formConfig}
        onSubmit={async (values, { issue }) => {
          // The legacy proforma shape has no attachments slot — refuse
          // loudly instead of dropping picked files silently.
          if (values.attachments.length > 0) {
            return {
              ok: false,
              error:
                "Proforma invoices don't store attachments yet — remove them to save.",
            };
          }
          const extras = readProformaExtras(values);
          const res = await createSabcrmProformaFull({
            proformaNumber: values.number,
            accountId: values.partyId ?? '',
            currency: values.currency,
            proformaDate: values.date,
            validTillDate: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            termsAndConditions: values.termsAndConditions || undefined,
            notes: values.customerNotes || undefined,
            linkedSoId: extras.linkedSoId || undefined,
            advancePct: parseOptionalNumber(extras.advancePct),
            advanceAmount: parseOptionalNumber(extras.advanceAmount),
            paymentDueDate: extras.paymentDueDate || undefined,
            expectedDelivery: extras.expectedDelivery || undefined,
            issue,
          });
          if (!res.ok) return res;
          toast.success(
            issue
              ? `${res.data.proformaNumber} issued.`
              : `${res.data.proformaNumber} saved as draft.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
