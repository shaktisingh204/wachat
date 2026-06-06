'use client';

/**
 * SabBackstage Check-in tab. A focused text input absorbs QR-scanner
 * gun input (the device just types into the field + presses Enter).
 * The submit handler dispatches `checkInSabbackstageTicket(qrCode)`
 * and prepends the result to a "Latest check-ins" log.
 *
 * A camera fallback button is stubbed — wiring the real camera scanner
 * (e.g. `html5-qrcode`) is a TODO so we avoid pulling another dep
 * into the bundle prematurely.
 */

import * as React from 'react';
import { Badge, Button, Input, Label, useToast } from '@/components/sabcrm/20ui';
import { Camera, Loader2, ScanLine } from 'lucide-react';

import {
  checkInSabbackstageTicket,
  listSabbackstageTickets,
} from '@/app/actions/sabbackstage.actions';
import type { SabbackstageTicketDoc } from '@/lib/rust-client/sabbackstage-tickets';

interface LogEntry {
  ticket: SabbackstageTicketDoc;
  at: string;
  duplicate: boolean;
}

export function SabbackstageCheckInTab({
  eventId,
}: {
  eventId: string;
}): React.JSX.Element {
  const { toast } = useToast();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [recent, setRecent] = React.useState<LogEntry[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    void (async () => {
      const r = await listSabbackstageTickets({
        eventId,
        status: 'checked_in',
        limit: 20,
      });
      if (r.ok) {
        setRecent(
          r.data.items.map((t) => ({
            ticket: t,
            at: t.checkedInAt ?? t.updatedAt ?? t.issuedAt,
            duplicate: false,
          })),
        );
      }
    })();
  }, [eventId]);

  async function handleSubmit(
    e?: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    e?.preventDefault();
    const qr = code.trim();
    if (!qr) return;
    setBusy(true);
    const r = await checkInSabbackstageTicket(qr, eventId);
    setBusy(false);
    setCode('');
    inputRef.current?.focus();
    if (!r.ok) {
      toast({
        title: 'Check-in failed',
        description: r.error,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: r.data.alreadyCheckedIn ? 'Already checked in' : 'Checked in',
      description: r.data.ticket.attendeeName,
    });
    setRecent((prev) => [
      {
        ticket: r.data.ticket,
        at: r.data.ticket.checkedInAt ?? new Date().toISOString(),
        duplicate: r.data.alreadyCheckedIn,
      },
      ...prev.slice(0, 49),
    ]);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-2 rounded-md border border-[var(--st-border)] p-3"
      >
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="ci-qr">Scan ticket QR</Label>
          <Input
            id="ci-qr"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Point scanner here and pull trigger…"
            autoComplete="off"
            inputMode="text"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanLine className="mr-1 h-3.5 w-3.5" />
          )}
          Check in
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast({
              title: 'Camera scanner — TODO',
              description: 'Wire html5-qrcode or zxing here.',
            })
          }
        >
          <Camera className="mr-1 h-3.5 w-3.5" /> Camera
        </Button>
      </form>

      <section>
        <h4 className="mb-2 text-[13px] font-semibold text-[var(--st-text)]">
          Latest check-ins
        </h4>
        {recent.length === 0 ? (
          <p className="text-[12.5px] text-[var(--st-text-secondary)]">
            No check-ins recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {recent.map((row, idx) => (
              <li
                key={`${row.ticket._id}-${idx}`}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <div className="text-[13px] text-[var(--st-text)]">
                    {row.ticket.attendeeName}
                  </div>
                  <div className="text-[12px] text-[var(--st-text-secondary)]">
                    {row.ticket.attendeeEmail} ·{' '}
                    {new Date(row.at).toLocaleTimeString()}
                  </div>
                </div>
                <Badge variant={row.duplicate ? 'warning' : 'success'}>
                  {row.duplicate ? 'duplicate' : 'in'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
