'use client';

/**
 * SabCRM Finance — Quotations list client (`/sabcrm/finance/quotations`).
 *
 * Doc-surface-kit adopter (finance-rollout spec §3.1): KPI strip (open
 * quote value / acceptance rate / expiring in 7 days / converted this
 * month), config-driven list (typed columns, search + status + customer
 * + date-range filters, server pagination, bulk actions, CSV export)
 * and the full DocForm drawer (real customer picker, real supply items,
 * server-recomputed totals, subject / reference / FX extras, SabFiles
 * attachments).
 *
 * Every row is display-ready: customers render as RESOLVED labels —
 * never a raw ObjectId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  CalendarClock,
  FileText,
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
  QUOTATION_STATUSES,
  quotationDetailHref,
  toQuotationFilters,
} from './quotation-config';
import {
  buildQuotationFormConfig,
  parseExchangeRate,
  readQuotationExtras,
} from './quotation-form';
import { maybeRequestDiscountApproval } from './quote-approval-submit';

import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  createSabcrmQuotationFull,
  exportSabcrmQuotationRows,
  listSabcrmQuotationsPage,
  transitionSabcrmQuotationStatus,
} from '@/app/actions/sabcrm-finance-quotations.actions';
import { deleteSabcrmQuotation } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmQuotationKpis,
  SabcrmQuotationListRow,
} from '@/app/actions/sabcrm-finance-quotations.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmQuotationListRow>[] = [
  {
    key: 'quotationNo',
    header: 'Number',
    kind: 'text',
    value: (r) => r.quotationNo,
  },
  {
    key: 'subject',
    header: 'Subject',
    kind: 'text',
    value: (r) => r.subject,
  },
  {
    key: 'party',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.partyLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'validUntil',
    header: 'Valid until',
    kind: 'date',
    value: (r) => r.validUntil,
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
];

/* ─── Component ───────────────────────────────────────────────── */

export interface QuotationsClientProps {
  initialRows: SabcrmQuotationListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmQuotationKpis | null;
}

export function QuotationsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: QuotationsClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmQuotationListRow>>(
    () => ({
      title: 'Quotations',
      description:
        'Sales quotes for this workspace — draft, send, track acceptance and convert into orders or invoices.',
      icon: FileText,
      entity: { singular: 'quotation', plural: 'quotations' },
      columns: COLUMNS,
      statuses: QUOTATION_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmQuotationsPage(toQuotationFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmQuotationRows(toQuotationFilters(filters)),
      csvFileName: 'quotations.csv',
      rowHref: (row) => quotationDetailHref(row.id),
      rowLabel: (row) => `quotation ${row.quotationNo}`,
      partyFilter: {
        placeholder: 'Any customer',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-sent',
          label: 'Mark as sent',
          icon: Send,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return { ok: false, error: 'Only draft quotations can be sent.' };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmQuotationStatus(row.id, 'sent');
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected quotations?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete quotations',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmQuotation(row.id);
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
    () => buildQuotationFormConfig({ withIssue: true }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Open quote value"
        icon={IndianRupee}
        value={formatDocMoney(kpis.openValue, kpis.currency)}
        delta={`${kpis.openCount} open ${kpis.openCount === 1 ? 'quotation' : 'quotations'}`}
      />
      <KpiCard
        label="Acceptance rate"
        icon={BadgeCheck}
        value={
          kpis.acceptanceRatePct === null ? '—' : `${kpis.acceptanceRatePct}%`
        }
        delta={
          kpis.acceptanceRatePct === null
            ? 'No resolved quotations yet'
            : 'Accepted + converted of resolved'
        }
        deltaTone={
          kpis.acceptanceRatePct !== null && kpis.acceptanceRatePct >= 50
            ? 'up'
            : 'neutral'
        }
      />
      <KpiCard
        label="Expiring in 7 days"
        icon={CalendarClock}
        value={String(kpis.expiringSoonCount)}
        delta={
          kpis.expiringSoonCount === 1
            ? 'open quotation nearing validity'
            : 'open quotations nearing validity'
        }
        deltaTone={kpis.expiringSoonCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Converted this month"
        icon={Repeat}
        value={String(kpis.convertedThisMonth)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} quotations`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'quotation' : 'quotations'}`
        }
        deltaTone={kpis.convertedThisMonth > 0 ? 'up' : 'neutral'}
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
            New quotation
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
          const extras = readQuotationExtras(values);
          const res = await createSabcrmQuotationFull({
            quotationNo: values.number,
            clientId: values.partyId ?? '',
            currency: values.currency,
            date: values.date,
            validUntil: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers,
            subject: extras.subject || undefined,
            referenceNo: extras.referenceNo || undefined,
            exchangeRate: parseExchangeRate(extras.exchangeRate),
            placeOfSupply: values.placeOfSupply || undefined,
            customerNotes: values.customerNotes || undefined,
            termsAndConditions: values.termsAndConditions || undefined,
            attachments: values.attachments,
            issue,
          });
          if (!res.ok) return res;
          toast.success(
            issue
              ? `${res.data.quotationNo} sent.`
              : `${res.data.quotationNo} saved as draft.`,
          );
          void maybeRequestDiscountApproval({
            lines: values.lines,
            quoteRef: res.data.quotationNo,
            targetRecordId: res.data._id,
          });
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
