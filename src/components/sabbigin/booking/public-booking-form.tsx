'use client';

/**
 * Public booking widget shown at `/book/[slug]`. Pick a day → pick a slot →
 * fill details → confirm. Submits via the unauthed `createPublicBooking`.
 */

import React from 'react';
import { CalendarCheck, Check, Clock } from 'lucide-react';

import {
  createPublicBooking,
  type BookingDay,
  type SabbiginBookingPageDoc,
} from '@/app/actions/sabbigin-bookings.actions';

export function PublicBookingForm({
  page,
  days,
}: {
  page: SabbiginBookingPageDoc;
  days: BookingDay[];
}) {
  const [dayIdx, setDayIdx] = React.useState(0);
  const [slot, setSlot] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const day = days[dayIdx];

  async function submit() {
    setError(null);
    if (!slot) {
      setError('Please pick a time slot.');
      return;
    }
    const missing = page.questions.filter((q) => q.required && !answers[q.key]?.trim());
    if (missing.length) {
      setError(`Please answer: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    const res = await createPublicBooking({
      slug: page.slug,
      startISO: slot,
      name,
      email,
      phone,
      answers,
    });
    setSubmitting(false);
    if (res.success) setDone(true);
    else setError(res.error ?? 'Could not book. Please try another slot.');
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--st-border,#e5e7eb)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Check size={24} />
        </div>
        <h2 className="text-lg font-semibold">You're booked!</h2>
        <p className="mt-1 text-sm text-gray-500">
          {page.confirmationMessage ||
            'Thanks — a confirmation is on its way. We look forward to speaking.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.2fr]">
      {/* Slot picker */}
      <div className="rounded-2xl border border-[var(--st-border,#e5e7eb)] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <CalendarCheck size={16} /> Pick a date
        </div>
        {days.length === 0 ? (
          <p className="text-sm text-gray-500">
            No availability right now. Please check back soon.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {days.map((d, i) => (
                <button
                  key={d.dateISO}
                  type="button"
                  onClick={() => {
                    setDayIdx(i);
                    setSlot(null);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    i === dayIdx
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-blue-400'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {day?.slots.map((s) => (
                <button
                  key={s.startISO}
                  type="button"
                  onClick={() => setSlot(s.startISO)}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors ${
                    slot === s.startISO
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  <Clock size={11} /> {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-[var(--st-border,#e5e7eb)] bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-medium text-gray-700">Your details</div>
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-gray-600">
            Name *
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Email *
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Phone
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          {page.questions.map((q) => (
            <label key={q.key} className="text-xs font-medium text-gray-600">
              {q.label}
              {q.required ? ' *' : ''}
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={answers[q.key] ?? ''}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [q.key]: e.target.value }))
                }
              />
            </label>
          ))}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !slot || !name || !email}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Booking…' : slot ? 'Confirm booking' : 'Pick a time first'}
          </button>
        </div>
      </div>
    </div>
  );
}
