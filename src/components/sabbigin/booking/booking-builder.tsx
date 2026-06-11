'use client';

/**
 * SabBigin booking-page builder. Configures availability windows, duration,
 * intake questions, and the linked pipeline, persisted via
 * `saveSabbiginBookingPage`. The resulting public page lives at `/book/[slug]`.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, Link as LinkIcon } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';
import {
  saveSabbiginBookingPage,
  type SabbiginBookingPageDoc,
  type AvailabilityWindow,
  type BookingQuestion,
} from '@/app/actions/sabbigin-bookings.actions';
import type { SabPipelineSummary } from '@/components/sabbigin/lib/types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BookingBuilder({
  initial,
  pipelines,
}: {
  initial: SabbiginBookingPageDoc | null;
  pipelines: SabPipelineSummary[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [durationMin, setDurationMin] = React.useState(initial?.durationMin ?? 30);
  const [timezone, setTimezone] = React.useState(initial?.timezone ?? 'Asia/Kolkata');
  const [dateRangeDays, setDateRangeDays] = React.useState(initial?.dateRangeDays ?? 30);
  const [bufferMin, setBufferMin] = React.useState(initial?.bufferMin ?? 0);
  const [pipelineId, setPipelineId] = React.useState(initial?.pipelineId ?? '');
  const [confirmationMessage, setConfirmationMessage] = React.useState(
    initial?.confirmationMessage ?? '',
  );
  const [windows, setWindows] = React.useState<AvailabilityWindow[]>(
    initial?.weeklyAvailability?.length
      ? initial.weeklyAvailability
      : [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '09:00', end: '17:00' })),
  );
  const [questions, setQuestions] = React.useState<BookingQuestion[]>(
    initial?.questions ?? [],
  );
  const [saving, setSaving] = React.useState(false);

  function dayEnabled(dow: number) {
    return windows.some((w) => w.dow === dow);
  }
  function toggleDay(dow: number) {
    setWindows((ws) =>
      dayEnabled(dow)
        ? ws.filter((w) => w.dow !== dow)
        : [...ws, { dow, start: '09:00', end: '17:00' }].sort((a, b) => a.dow - b.dow),
    );
  }
  function setDayTime(dow: number, key: 'start' | 'end', value: string) {
    setWindows((ws) => ws.map((w) => (w.dow === dow ? { ...w, [key]: value } : w)));
  }

  function autoSlug(v: string) {
    if (!initial && !slug) {
      setSlug(v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }

  async function save() {
    setSaving(true);
    const res = await saveSabbiginBookingPage({
      id: initial?._id || undefined,
      title,
      slug,
      description,
      durationMin: Number(durationMin),
      timezone,
      dateRangeDays: Number(dateRangeDays),
      bufferMin: Number(bufferMin),
      weeklyAvailability: windows,
      questions,
      pipelineId: pipelineId || undefined,
      confirmationMessage: confirmationMessage || undefined,
    });
    setSaving(false);
    if (res.success) {
      toast.success({ title: 'Booking page saved' });
      router.push('/dashboard/sabbigin/settings/booking');
      router.refresh();
    } else {
      toast.error({ title: 'Save failed', description: res.error });
    }
  }

  const publicUrl = slug ? `/book/${slug}` : '';

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg">
        <CardHeader>
          <CardTitle>Page details</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  autoSlug(e.target.value);
                }}
                placeholder="Intro call"
              />
            </Field>
            <Field label="Public URL slug">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="intro-call"
              />
            </Field>
            <Field label="Meeting length (minutes)">
              <Input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              />
            </Field>
            <Field label="Buffer between meetings (minutes)">
              <Input
                type="number"
                value={bufferMin}
                onChange={(e) => setBufferMin(Number(e.target.value))}
              />
            </Field>
            <Field label="Bookable window (days ahead)">
              <Input
                type="number"
                value={dateRangeDays}
                onChange={(e) => setDateRangeDays(Number(e.target.value))}
              />
            </Field>
            <Field label="Timezone">
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </Field>
            <Field label="Create deal in pipeline (optional)">
              <select
                className="u-input"
                value={pipelineId ?? ''}
                onChange={(e) => setPipelineId(e.target.value)}
              >
                <option value="">— none —</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description (shown to bookers)">
                <Textarea
                  value={description ?? ''}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </Field>
            </div>
          </div>
          {publicUrl && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]">
              <LinkIcon size={12} /> Public link:{' '}
              <code className="text-[var(--st-accent)]">{publicUrl}</code>
            </p>
          )}
        </CardBody>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-2">
            {DOW.map((label, dow) => {
              const w = windows.find((x) => x.dow === dow);
              return (
                <div key={dow} className="flex items-center gap-3">
                  <label className="flex w-24 items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={dayEnabled(dow)}
                      onChange={() => toggleDay(dow)}
                    />
                    {label}
                  </label>
                  {w ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        className="u-input u-input--sm"
                        value={w.start}
                        onChange={(e) => setDayTime(dow, 'start', e.target.value)}
                      />
                      <span className="text-[var(--st-text-secondary)]">to</span>
                      <input
                        type="time"
                        className="u-input u-input--sm"
                        value={w.end}
                        onChange={(e) => setDayTime(dow, 'end', e.target.value)}
                      />
                    </div>
                  ) : (
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                      Unavailable
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            <CardTitle>Intake questions</CardTitle>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Plus size={13} />}
              onClick={() =>
                setQuestions((q) => [
                  ...q,
                  { key: `q${q.length + 1}`, label: '', required: false },
                ])
              }
            >
              Add question
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {questions.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Name, email and phone are always collected. Add custom questions to
              gather more context up front.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={q.label}
                    placeholder="e.g. What would you like to discuss?"
                    onChange={(e) =>
                      setQuestions((qs) =>
                        qs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      )
                    }
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-[12px]">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        setQuestions((qs) =>
                          qs.map((x, j) =>
                            j === i ? { ...x, required: e.target.checked } : x,
                          ),
                        )
                      }
                    />
                    Required
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Trash2 size={13} />}
                    onClick={() =>
                      setQuestions((qs) => qs.filter((_, j) => j !== i))
                    }
                  >
                    {''}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <CardTitle>Confirmation</CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="Confirmation message (shown after booking)">
            <Textarea
              value={confirmationMessage ?? ''}
              onChange={(e) => setConfirmationMessage(e.target.value)}
              rows={2}
              placeholder="Thanks! I'll see you then. A calendar invite is on its way."
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" iconLeft={<Save size={14} />} loading={saving} onClick={save}>
          Save booking page
        </Button>
      </div>
    </div>
  );
}
