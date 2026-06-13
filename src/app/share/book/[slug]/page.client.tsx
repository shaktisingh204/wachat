'use client';

/**
 * PUBLIC booking surface — client component.
 *
 * Rendered by the unauthenticated booking page. Loads availability for the
 * slug via the UNGATED `getPublicAvailability` action, groups the returned
 * ISO slots by calendar day (formatted in the link's timezone), and lets a
 * visitor pick a slot + fill a short contact form. Submitting calls the
 * UNGATED-but-validated `createBookingPublic`, which re-validates the slot
 * server-side and creates the CRM record + meeting (+ optional calendar event).
 *
 * Pure 20ui, wrapped in `.20ui` so the design-system tokens apply on this
 * standalone (shell-less) public page. A hidden honeypot field (`_hp`) screens
 * bots. Degrades to loading / unavailable / empty / success states.
 */

import * as React from 'react';
import { CalendarClock, Clock, Check, ChevronLeft } from 'lucide-react';

import {
  Card,
  Button,
  Field,
  Input,
  Textarea,
  Badge,
  Alert,
  Spinner,
  EmptyState,
} from '@/components/sabcrm/20ui';
import {
  getPublicAvailability,
  createBookingPublic,
} from '@/app/actions/sabcrm-booking.actions';
import type { PublicBookingLink } from '@/lib/sabcrm/booking.server';
import type { BookingSlot } from '@/lib/sabcrm/booking';

interface DayGroup {
  /** `YYYY-MM-DD` in the link tz. */
  dayKey: string;
  /** e.g. "Wed, Jan 8". */
  dayLabel: string;
  slots: BookingSlot[];
}

/** Format an ISO instant as a `HH:mm`-ish time in the link tz. */
function fmtTime(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

/** Format an ISO instant as a long day label in the link tz. */
function fmtDay(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** The `YYYY-MM-DD` day key of an instant in a tz (for grouping). */
function dayKeyOf(iso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
    return parts; // en-CA → YYYY-MM-DD
  } catch {
    return iso.slice(0, 10);
  }
}

function groupByDay(slots: BookingSlot[], tz: string): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of slots) {
    const dayKey = dayKeyOf(s.startIso, tz);
    let g = map.get(dayKey);
    if (!g) {
      g = { dayKey, dayLabel: fmtDay(s.startIso, tz), slots: [] };
      map.set(dayKey, g);
    }
    g.slots.push(s);
  }
  return [...map.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PublicBookingClient({ slug }: { slug: string }): React.ReactElement {
  const [loading, setLoading] = React.useState(true);
  const [link, setLink] = React.useState<PublicBookingLink | null>(null);
  const [days, setDays] = React.useState<DayGroup[]>([]);
  const [calendarConnected, setCalendarConnected] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<BookingSlot | null>(null);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [note, setNote] = React.useState('');
  const [hp, setHp] = React.useState(''); // honeypot

  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ when: string } | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    (async () => {
      const res = await getPublicAvailability(slug);
      if (!alive) return;
      if (!res.ok) {
        setLoadError(res.error);
        setLoading(false);
        return;
      }
      setLink(res.data.link);
      setCalendarConnected(res.data.calendarConnected);
      setDays(groupByDay(res.data.slots, res.data.link.tz));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  async function submit(): Promise<void> {
    if (!selected || !link) return;
    setFormError(null);
    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setFormError('Please enter a valid email.');
      return;
    }
    setSubmitting(true);
    const res = await createBookingPublic(slug, selected.startIso, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      _hp: hp,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setDone({ when: `${fmtDay(res.data.slot.startIso, link.tz)} · ${fmtTime(res.data.slot.startIso, link.tz)}` });
  }

  const shell = (children: React.ReactNode): React.ReactElement => (
    <div className="20ui">
      <div className="mx-auto flex min-h-screen max-w-[680px] flex-col gap-[var(--st-space-4,16px)] px-4 py-10">
        {children}
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <Card className="flex items-center justify-center p-[var(--st-space-6,24px)]">
        <Spinner />
      </Card>,
    );
  }

  if (loadError || !link) {
    return shell(
      <Card className="p-[var(--st-space-6,24px)]">
        <EmptyState
          icon={CalendarClock}
          title="Booking link unavailable"
          description={loadError ?? 'This booking link is not available.'}
        />
      </Card>,
    );
  }

  if (done) {
    return shell(
      <Card className="flex flex-col items-center gap-[var(--st-space-3,12px)] p-[var(--st-space-6,24px)] text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-success-bg,#dcfce7)] text-[var(--st-success,#16a34a)]">
          <Check />
        </div>
        <h1 className="text-[18px] font-semibold text-[var(--st-text)]">
          You&rsquo;re booked
        </h1>
        <p className="text-[14px] text-[var(--st-text-secondary)]">
          {link.name} — {done.when} ({link.tz})
        </p>
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          A confirmation has been recorded. We look forward to speaking with you.
        </p>
      </Card>,
    );
  }

  return shell(
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
          <CalendarClock size={18} />
          <span className="inline-flex items-center gap-1 text-[13px]">
            <Clock size={13} /> {link.durationMins} min
          </span>
          {calendarConnected && (
            <Badge tone="success" kind="soft">
              Live availability
            </Badge>
          )}
        </div>
        <h1 className="text-[22px] font-semibold text-[var(--st-text)]">
          {link.name}
        </h1>
        {link.description && (
          <p className="text-[14px] text-[var(--st-text-secondary)]">
            {link.description}
          </p>
        )}
      </header>

      {!selected ? (
        <Card className="flex flex-col gap-[var(--st-space-4,16px)] p-[var(--st-space-4,16px)]">
          {days.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No times available"
              description="There are no open slots in the booking window right now. Please check back later."
            />
          ) : (
            days.map((day) => (
              <div key={day.dayKey} className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  {day.dayLabel}
                </span>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <Button
                      key={slot.startIso}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelected(slot);
                        setFormError(null);
                      }}
                    >
                      {fmtTime(slot.startIso, link.tz)}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </Card>
      ) : (
        <Card className="flex flex-col gap-[var(--st-space-3,12px)] p-[var(--st-space-4,16px)]">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 self-start text-[13px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            <ChevronLeft size={14} /> Back to times
          </button>

          <div className="rounded-[var(--st-radius,8px)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[13px] text-[var(--st-text)]">
            {fmtDay(selected.startIso, link.tz)} ·{' '}
            {fmtTime(selected.startIso, link.tz)}–
            {fmtTime(selected.endIso, link.tz)} ({link.tz})
          </div>

          {formError && <Alert tone="danger">{formError}</Alert>}

          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              autoComplete="tel"
            />
          </Field>
          <Field label="Anything we should know?">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </Field>

          {/* Honeypot — hidden from humans, bots tend to fill it. */}
          <input
            type="text"
            name="_hp"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
          />

          <Button
            variant="primary"
            onClick={submit}
            loading={submitting}
            disabled={submitting}
          >
            Confirm booking
          </Button>
        </Card>
      )}

      <footer className="text-center text-[11px] text-[var(--st-text-secondary)]">
        Powered by SabCRM
      </footer>
    </>,
  );
}

export default PublicBookingClient;
