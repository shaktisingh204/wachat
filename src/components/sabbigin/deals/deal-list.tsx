'use client';

/**
 * SabBigin deals list view with row selection + a bulk-action bar. Reuses the
 * existing CRM bulk actions (change stage / archive). Row click → deal detail.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Archive, ChevronRight } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  toast,
} from '@/components/sabcrm/20ui';
import { bulkArchiveDeals, bulkChangeStage } from '@/app/actions/crm-deals.actions';
import type { SabDealRow, SabStage } from '@/components/sabbigin/lib/types';
import {
  formatCurrency,
  formatDate,
  badgeToneForStage,
} from '@/components/sabbigin/lib/format';

export function DealList({
  deals,
  stages,
  currency = 'INR',
}: {
  deals: SabDealRow[];
  stages: SabStage[];
  currency?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) =>
      s.size === deals.length ? new Set() : new Set(deals.map((d) => d._id)),
    );
  }

  async function doArchive() {
    setBusy(true);
    const res = await bulkArchiveDeals([...selected]);
    setBusy(false);
    if ((res as any)?.error) {
      toast.error({ title: 'Archive failed', description: (res as any).error });
    } else {
      toast.success({ title: `Archived ${selected.size} deal(s)` });
      setSelected(new Set());
      router.refresh();
    }
  }

  async function doChangeStage(stage: string) {
    setBusy(true);
    const res = await bulkChangeStage([...selected], stage);
    setBusy(false);
    if ((res as any)?.error) {
      toast.error({ title: 'Update failed', description: (res as any).error });
    } else {
      toast.success({ title: `Moved ${selected.size} deal(s) to ${stage}` });
      setSelected(new Set());
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-1.5">
            <select
              className="u-input u-input--sm"
              defaultValue=""
              onChange={(e) => e.target.value && doChangeStage(e.target.value)}
              disabled={busy}
            >
              <option value="" disabled>
                Move to stage…
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Archive size={13} />}
              loading={busy}
              onClick={doArchive}
            >
              Archive
            </Button>
          </div>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <Table density="comfortable" hover>
          <THead>
            <Tr>
              <Th>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selected.size === deals.length && deals.length > 0}
                  onChange={toggleAll}
                />
              </Th>
              <Th>Deal</Th>
              <Th>Stage</Th>
              <Th align="right">Value</Th>
              <Th>Contact</Th>
              <Th>Close date</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {deals.map((d) => (
              <Tr key={d._id}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${d.name}`}
                    checked={selected.has(d._id)}
                    onChange={() => toggle(d._id)}
                  />
                </Td>
                <Td>
                  <Link
                    href={`/dashboard/sabbigin/deals/${d._id}`}
                    className="font-medium text-[var(--st-text)] hover:text-[var(--st-accent)]"
                  >
                    {d.name}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={badgeToneForStage(d.stage)}>{d.stage}</Badge>
                </Td>
                <Td align="right" className="tabular-nums">
                  {d.amount != null
                    ? formatCurrency(d.amount, d.currency || currency)
                    : '—'}
                </Td>
                <Td className="text-[var(--st-text-secondary)]">
                  {d.contactName ?? '—'}
                </Td>
                <Td className="text-[var(--st-text-secondary)]">
                  {formatDate(d.expectedClose)}
                </Td>
                <Td>
                  <Link
                    href={`/dashboard/sabbigin/deals/${d._id}`}
                    className="u-icon-btn u-icon-btn--sm"
                    aria-label="Open deal"
                  >
                    <ChevronRight size={15} />
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
