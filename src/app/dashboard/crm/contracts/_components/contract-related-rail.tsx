import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
/**
 * <ContractRelatedRail> — server-rendered right rail. Status card, party
 * chips, and a "Related" stub listing renewal/amendment counts. The
 * lineage rail is rendered by the page itself since this entity is part
 * of the §13.5 sales chain (deal → contract → invoice).
 */

import Link from 'next/link';

function daysBetween(start: unknown, end: unknown): number | null {
  if (!end) return null;
  const e = new Date(end as string);
  if (Number.isNaN(e.getTime())) return null;
  const s = start ? new Date(start as string) : new Date();
  if (Number.isNaN(s.getTime())) return null;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}

// Fixed date formatter for hydration stability
function formatDate(d: unknown): string {
  if (!d) return '—';
  const dt = new Date(d as string);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toISOString().slice(0, 10);
}

interface ContractRelatedRailProps {
  contractId: string;
  status?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  clientName?: string;
  value?: number;
  currency?: string;
}

export function ContractRelatedRail({
  contractId,
  status,
  startDate,
  endDate,
  clientName,
  value,
  currency,
}: ContractRelatedRailProps) {
  const remaining = daysBetween(new Date(), endDate);
  const fmtMoney =
    typeof value === 'number'
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: currency || 'INR',
          maximumFractionDigits: 0,
        }).format(value)
      : '—';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-3 text-[12.5px]">
            <div className="flex items-center justify-between">
              <span className="text-[var(--st-text-secondary)]">Status</span>
              <Badge variant="outline">{status || 'draft'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--st-text-secondary)]">Days remaining</span>
              <span
                className={`font-mono tabular-nums ${
                  remaining !== null && remaining < 0
                    ? 'text-[var(--st-danger)]'
                    : 'text-[var(--st-text)]'
                }`}
              >
                {remaining === null
                  ? '—'
                  : remaining < 0
                  ? `${Math.abs(remaining)}d overdue`
                  : `${remaining}d`}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-2">
              <span className="text-[var(--st-text-secondary)]">Value</span>
              <span className="font-mono tabular-nums">{fmtMoney}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parties</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-3 text-[12.5px]">
            <div>
              <div className="text-[11px] uppercase text-[var(--st-text-secondary)]">
                Party A
              </div>
              <div className="mt-0.5 text-[var(--st-text)]">Our organization</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-[var(--st-text-secondary)]">
                Party B
              </div>
              <div className="mt-0.5 text-[var(--st-text)]">{clientName || '—'}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Related</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-2 text-[12.5px]">
            <Link
              href={`/dashboard/crm/contracts/renewals?contractId=${contractId}`}
              className="text-[var(--st-text)] hover:underline"
            >
              Renewals →
            </Link>
            {/* TODO 1D.2: contract amendments collection not yet implemented */}
            <span className="text-[var(--st-text-secondary)]">
              Amendments — coming soon
            </span>
            <Link
              href={`/dashboard/crm/sales/invoices?contractId=${contractId}`}
              className="text-[var(--st-text)] hover:underline"
            >
              Linked invoices →
            </Link>
          </div>
        </CardBody>
      </Card>

      {startDate ? (
        <Card>
          <CardHeader>
            <CardTitle>Term</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">Start</span>
                <span>
                  {formatDate(startDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">End</span>
                <span>
                  {formatDate(endDate)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
