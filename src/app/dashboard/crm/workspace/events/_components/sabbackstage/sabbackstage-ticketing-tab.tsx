'use client';

/**
 * SabBackstage Ticketing tab — ticket-type CRUD + per-type capacity /
 * sold progress + an orders log with refund action.
 *
 * Reads:
 *   - listSabbackstageTicketTypes({ eventId })
 *   - listSabbackstageOrders({ eventId })
 * Writes:
 *   - createSabbackstageTicketType / updateSabbackstageTicketType /
 *     deleteSabbackstageTicketType
 *   - refundSabbackstageOrder
 */

import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Label,
  Progress,
  useZoruToast,
} from '@/components/zoruui';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';

import {
  listSabbackstageTicketTypes,
  createSabbackstageTicketType,
  updateSabbackstageTicketType,
  deleteSabbackstageTicketType,
  listSabbackstageOrders,
  refundSabbackstageOrder,
} from '@/app/actions/sabbackstage.actions';
import type {
  SabbackstageTicketTypeDoc,
  SabbackstageTicketTypeStatus,
} from '@/lib/rust-client/sabbackstage-ticket-types';
import type { SabbackstageOrderDoc } from '@/lib/rust-client/sabbackstage-orders';

interface NewTypeForm {
  name: string;
  priceMinor: string;
  capacity: string;
  status: SabbackstageTicketTypeStatus;
}

const EMPTY_FORM: NewTypeForm = {
  name: '',
  priceMinor: '0',
  capacity: '0',
  status: 'draft',
};

function formatMoney(minor: number, currency: string): string {
  const major = (minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency || ''}`.trim();
  }
}

export function SabbackstageTicketingTab({
  eventId,
}: {
  eventId: string;
}): React.JSX.Element {
  const { toast } = useZoruToast();
  const [types, setTypes] = React.useState<SabbackstageTicketTypeDoc[]>([]);
  const [orders, setOrders] = React.useState<SabbackstageOrderDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState<NewTypeForm>(EMPTY_FORM);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [t, o] = await Promise.all([
      listSabbackstageTicketTypes({ eventId, status: 'all', limit: 100 }),
      listSabbackstageOrders({ eventId, status: 'all', limit: 100 }),
    ]);
    if (t.ok) setTypes(t.data.items);
    if (o.ok) setOrders(o.data.items);
    setLoading(false);
  }, [eventId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(): Promise<void> {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const r = await createSabbackstageTicketType({
      eventId,
      name: form.name.trim(),
      priceMinor: Number(form.priceMinor) || 0,
      capacity: Number(form.capacity) || 0,
      status: form.status,
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: 'Failed', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ticket type created' });
    setForm(EMPTY_FORM);
    await refresh();
  }

  async function handleStatus(
    id: string,
    status: SabbackstageTicketTypeStatus,
  ): Promise<void> {
    const r = await updateSabbackstageTicketType(id, { status }, eventId);
    if (!r.ok) {
      toast({ title: 'Failed', description: r.error, variant: 'destructive' });
      return;
    }
    await refresh();
  }

  async function handleDelete(id: string): Promise<void> {
    const r = await deleteSabbackstageTicketType(id, eventId);
    if (!r.ok) {
      toast({ title: 'Failed', description: r.error, variant: 'destructive' });
      return;
    }
    await refresh();
  }

  async function handleRefund(id: string): Promise<void> {
    const r = await refundSabbackstageOrder(id);
    if (!r.ok) {
      toast({ title: 'Refund failed', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Order refunded' });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-zoru-ink">
            Ticket types
          </h4>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zoru-ink-muted" />
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-md border border-zoru-line p-3 md:grid-cols-5">
          <div>
            <Label htmlFor="bt-name">Name</Label>
            <Input
              id="bt-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VIP, Early Bird…"
            />
          </div>
          <div>
            <Label htmlFor="bt-price">Price (minor)</Label>
            <Input
              id="bt-price"
              type="number"
              value={form.priceMinor}
              onChange={(e) => setForm({ ...form, priceMinor: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bt-cap">Capacity</Label>
            <Input
              id="bt-cap"
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bt-status">Status</Label>
            <select
              id="bt-status"
              className="block h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-2 text-[13px] text-zoru-ink"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as SabbackstageTicketTypeStatus,
                })
              }
            >
              <option value="draft">draft</option>
              <option value="live">live</option>
              <option value="paused">paused</option>
              <option value="soldout">soldout</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreate} disabled={busy} type="button">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-zoru-line">
          {types.length === 0 ? (
            <li className="py-3 text-[12.5px] text-zoru-ink-muted">
              No ticket types yet.
            </li>
          ) : (
            types.map((t) => {
              const pct =
                t.capacity > 0
                  ? Math.min(100, Math.round((t.soldCount / t.capacity) * 100))
                  : 0;
              return (
                <li key={t._id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-medium text-zoru-ink">
                        {t.name}{' '}
                        <span className="text-[12px] text-zoru-ink-muted">
                          · {formatMoney(t.priceMinor, t.currency)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-zoru-ink-muted">
                        {t.soldCount} / {t.capacity || '∞'} sold
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={t.status === 'live' ? 'success' : 'secondary'}
                      >
                        {t.status}
                      </Badge>
                      <select
                        className="h-8 rounded-md border border-zoru-line bg-zoru-bg px-2 text-[12px]"
                        value={t.status}
                        onChange={(e) =>
                          handleStatus(
                            t._id,
                            e.target.value as SabbackstageTicketTypeStatus,
                          )
                        }
                      >
                        <option value="draft">draft</option>
                        <option value="live">live</option>
                        <option value="paused">paused</option>
                        <option value="soldout">soldout</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleDelete(t._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {t.capacity > 0 ? (
                    <Progress value={pct} className="mt-2" />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section>
        <h4 className="mb-2 text-[13px] font-semibold text-zoru-ink">
          Orders log
        </h4>
        {orders.length === 0 ? (
          <p className="text-[12.5px] text-zoru-ink-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-zoru-line">
            {orders.map((o) => (
              <li
                key={o._id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <div className="text-[13px] text-zoru-ink">
                    {o.buyerName}{' '}
                    <span className="text-zoru-ink-muted">· {o.buyerEmail}</span>
                  </div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    {formatMoney(o.totals.totalMinor, o.totals.currency)} ·{' '}
                    {o.items.reduce((n, it) => n + it.qty, 0)} seats
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      o.status === 'paid'
                        ? 'success'
                        : o.status === 'refunded'
                        ? 'warning'
                        : o.status === 'failed'
                        ? 'danger'
                        : 'secondary'
                    }
                  >
                    {o.status}
                  </Badge>
                  {o.status === 'paid' ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRefund(o._id)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Refund
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
