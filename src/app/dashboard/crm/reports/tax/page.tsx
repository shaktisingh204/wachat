export const dynamic = 'force-dynamic';

import { Calculator } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  fmtMoney,
} from '../_components/report-toolbar';
import { getTaxSummary } from '@/app/actions/worksuite/reports.actions';

export default async function TaxReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const summary = await getTaxSummary(sp.from, sp.to);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Tax Report"
        subtitle="Tax collected on invoices minus tax paid on expenses."
        icon={Calculator}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Tax collected"
          value={fmtMoney(summary.taxCollected)}
          tone="green"
          hint="From invoice total minus subtotal"
        />
        <StatCard
          label="Tax paid"
          value={fmtMoney(summary.taxPaid)}
          tone="red"
          hint="From expense taxAmount"
        />
        <StatCard
          label="Net tax liability"
          value={fmtMoney(summary.net)}
          tone={summary.net >= 0 ? 'amber' : 'green'}
        />
      </div>

      <ClayCard>
        <p className="text-[13px] text-muted-foreground">
          This is an overview. For line-item compliance reports see{' '}
          <a
            href="/dashboard/crm/reports/gstr-1"
            className="text-primary underline"
          >
            GSTR-1
          </a>{' '}
          and{' '}
          <a
            href="/dashboard/crm/reports/gstr-2b"
            className="text-primary underline"
          >
            GSTR-2B
          </a>
          .
        </p>
      </ClayCard>
    </div>
  );
}
