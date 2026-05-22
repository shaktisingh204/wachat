import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
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
        <ZoruCardHeader>
          <ZoruCardTitle>Status</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="space-y-3 text-[12.5px]">
            <div className="flex items-center justify-between">
              <span className="text-zoru-ink-muted">Status</span>
              <Badge variant="outline">{status || 'draft'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zoru-ink-muted">Days remaining</span>
              <span
                className={`font-mono tabular-nums ${
                  remaining !== null && remaining < 0
                    ? 'text-zoru-danger-ink'
                    : 'text-zoru-ink'
                }`}
              >
                {remaining === null
                  ? '—'
                  : remaining < 0
                  ? `${Math.abs(remaining)}d overdue`
                  : `${remaining}d`}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-zoru-line pt-2">
              <span className="text-zoru-ink-muted">Value</span>
              <span className="font-mono tabular-nums">{fmtMoney}</span>
            </div>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Parties</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="space-y-3 text-[12.5px]">
            <div>
              <div className="text-[11px] uppercase text-zoru-ink-muted">
                Party A
              </div>
              <div className="mt-0.5 text-zoru-ink">Our organization</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-zoru-ink-muted">
                Party B
              </div>
              <div className="mt-0.5 text-zoru-ink">{clientName || '—'}</div>
            </div>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Related</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-col gap-2 text-[12.5px]">
            <Link
              href={`/dashboard/crm/contracts/renewals?contractId=${contractId}`}
              className="text-zoru-primary hover:underline"
            >
              Renewals →
            </Link>
            {/* TODO 1D.2: contract amendments collection not yet implemented */}
            <span className="text-zoru-ink-muted">
              Amendments — coming soon
            </span>
            <Link
              href={`/dashboard/crm/sales/invoices?contractId=${contractId}`}
              className="text-zoru-primary hover:underline"
            >
              Linked invoices →
            </Link>
          </div>
        </ZoruCardContent>
      </Card>

      {startDate ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Term</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">Start</span>
                <span>
                  {new Date(startDate as string).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zoru-ink-muted">End</span>
                <span>
                  {endDate
                    ? new Date(endDate as string).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
          </ZoruCardContent>
        </Card>
      ) : null}
    </>
  );
}
