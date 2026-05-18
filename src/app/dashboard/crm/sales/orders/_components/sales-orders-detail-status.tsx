'use client';

/**
 * <SalesOrderInlineStatus> — clickable status pill on the SO detail
 * page that opens an inline `<EnumFormField enumName="salesOrderStatus">`
 * popover and round-trips the new value through the
 * `setSalesOrderStatus` server action.
 *
 * The pill defers to `<StatusPill>` for the read state. Tapping the
 * pill flips into edit mode; picking a new value commits, refreshes
 * the route (so the lineage rail + audit timeline pick up the
 * server-side mutation), and exits edit mode. `Esc` / clicking outside
 * cancels.
 *
 * Implements the §1D.2 inline-status-change contract for sales orders
 * — same pattern can be ported to invoices / quotations.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, X } from 'lucide-react';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { useZoruToast } from '@/components/zoruui';
import { setSalesOrderStatus } from '@/app/actions/crm/sales-orders.actions';

interface Props {
  /** Sales-order id used for the server-action call. */
  id: string;
  /** Current status — lowercase Rust DTO value. */
  status: string;
}

export function SalesOrderInlineStatus({ id, status }: Props) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [editing, setEditing] = React.useState(false);
  const [optimistic, setOptimistic] = React.useState(status);
  const [pending, startTransition] = React.useTransition();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setOptimistic(status);
  }, [status]);

  // Close on outside click / Esc.
  React.useEffect(() => {
    if (!editing) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditing(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [editing]);

  const commit = (next: string | null) => {
    if (!next || next === optimistic) {
      setEditing(false);
      return;
    }
    const prev = optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const res = await setSalesOrderStatus(id, next);
      if (res.success) {
        toast({ title: `Status set to ${next}` });
        setEditing(false);
        router.refresh();
      } else {
        setOptimistic(prev);
        toast({
          title: 'Status update failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-zoru-primary"
        aria-label="Change sales-order status"
      >
        <StatusPill label={optimistic} tone={statusToTone(optimistic)} />
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-surface px-2 py-1 shadow-sm"
    >
      <div className="min-w-[180px]">
        <EnumFormField
          enumName="salesOrderStatus"
          name="__so_status_picker"
          initialId={optimistic || null}
          onChange={(next) => commit(next)}
          allowInlineCreate={false}
        />
      </div>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded p-1 text-zoru-ink-muted hover:bg-zoru-surface-2"
        aria-label="Cancel"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
