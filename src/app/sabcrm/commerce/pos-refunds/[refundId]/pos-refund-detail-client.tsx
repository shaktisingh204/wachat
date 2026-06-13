'use client';

/**
 * SabCRM Commerce — POS refund detail client (DocDetailPage adopter,
 * spec WI-20, read-mostly).
 *
 * The refund on the doc-surface paper: refunded lines joined against
 * the original transaction's line names (the refund only stores
 * indices + amounts), the original transaction as the related rail,
 * and a vocab-guarded status transition (pending → completed; failed
 * exception) driven by `SABCRM_POS_REFUND_TRANSITIONS`. Every action
 * re-runs the full gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';

import {
  DocDetailPage,
  type DocDetailLine,
  type DocRelatedRef,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  POS_REFUND_FLOW,
  POS_REFUND_STATUSES,
  POS_REFUNDS_PATH,
} from '../pos-refunds-config';
import { posTransactionDetailHref } from '../../pos-transactions/pos-transactions-config';

import { updateSabcrmPosRefundStatus } from '@/app/actions/sabcrm-commerce-docs.actions';
import {
  SABCRM_POS_REFUND_TRANSITIONS,
  type SabcrmPosRefundUiStatus,
} from '@/app/actions/sabcrm-commerce-docs.actions.types';
import type { CrmPosRefundDoc } from '@/lib/rust-client/sabcrm-commerce';

interface OriginalLine {
  name: string;
  rate: number;
}

export interface PosRefundDetailClientProps {
  refund: CrmPosRefundDoc;
  originalLines: OriginalLine[];
  transactionNumber: string | null;
}

const STATUS_ICON: Partial<
  Record<SabcrmPosRefundUiStatus, typeof CheckCircle2>
> = {
  completed: CheckCircle2,
  failed: XCircle,
};

export function PosRefundDetailClient({
  refund,
  originalLines,
  transactionNumber,
}: PosRefundDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const status = (refund.status ?? 'pending') as SabcrmPosRefundUiStatus;
  const nextStates = SABCRM_POS_REFUND_TRANSITIONS[status] ?? [];

  const transition = (next: SabcrmPosRefundUiStatus): void => {
    startTransition(async () => {
      const res = await updateSabcrmPosRefundStatus(refund._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Refund marked ${next}.`);
      router.refresh();
    });
  };

  const lines: DocDetailLine[] = refund.refundedLineItems.map((rl) => {
    const orig = originalLines[rl.originalLineItemIndex];
    return {
      description: orig?.name ?? `Line ${rl.originalLineItemIndex + 1}`,
      qty: rl.quantity,
      rate: rl.quantity > 0 ? rl.refundAmount / rl.quantity : rl.refundAmount,
      total: rl.refundAmount,
    };
  });

  const related: DocRelatedRef[] = [
    {
      kind: 'posTransaction',
      id: refund.originalTransactionId,
      label: transactionNumber ?? 'Original transaction',
      href: posTransactionDetailHref(refund.originalTransactionId),
      direction: 'parent',
    },
  ];

  return (
    <DocDetailPage
      backHref={POS_REFUNDS_PATH}
      backLabel="POS refunds"
      docNumber={
        transactionNumber ? `Refund · ${transactionNumber}` : `Refund ${refund._id}`
      }
      entitySingular="Refund"
      statuses={POS_REFUND_STATUSES}
      flow={POS_REFUND_FLOW}
      status={status}
      actions={
        nextStates.length ? (
          <>
            {nextStates.map((next) => {
              const Icon = STATUS_ICON[next];
              return (
                <Button
                  key={next}
                  variant={next === 'failed' ? 'ghost' : 'primary'}
                  iconLeft={Icon}
                  loading={pending}
                  onClick={() => transition(next)}
                >
                  Mark {next}
                </Button>
              );
            })}
          </>
        ) : undefined
      }
      party={{
        label: 'Refund processed',
        href: null,
        meta: refund.processedBy,
      }}
      meta={[
        { label: 'Processed', value: refund.processedAt.slice(0, 10) },
        { label: 'Method', value: refund.refundMethod },
        { label: 'Reason', value: refund.reason || '—' },
        { label: 'Processed by', value: refund.processedBy },
      ]}
      currency="INR"
      lines={lines}
      totals={{ subTotal: refund.refundTotal, total: refund.refundTotal }}
      related={related}
    />
  );
}
