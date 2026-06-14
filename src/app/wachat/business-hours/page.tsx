'use client';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Modal,
  EmptyState,
  Field,
  Input,
  SelectField as Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { CalendarOff,
  Loader2,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getBusinessHours,
  saveBusinessHours,
  } from '@/app/actions/wachat-features.actions';
import WachatPage from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Business Hours — 20ui migration.
 * Weekly schedule + holiday list + offline auto-reply config.
 */

import * as React from 'react';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Kolkata', label: 'IST (Asia/Kolkata)' },
  { value: 'America/New_York', label: 'EST (America/New_York)' },
  { value: 'America/Los_Angeles', label: 'PST (America/Los_Angeles)' },
  { value: 'Europe/London', label: 'GMT (Europe/London)' },
  { value: 'Europe/Berlin', label: 'CET (Europe/Berlin)' },
  { value: 'Asia/Dubai', label: 'GST (Asia/Dubai)' },
  { value: 'Asia/Singapore', label: 'SGT (Asia/Singapore)' },
  { value: 'Australia/Sydney', label: 'AEST (Australia/Sydney)' },
];

// 30-min increments for the schedule grid time pickers
const TIME_OPTIONS = (() => {
  const arr: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      arr.push({ value: t, label: t });
    }
  }
  return arr;
})();

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

type DaySchedule = { open: boolean; start: string; end: string };
type WeekSchedule = Record<string, DaySchedule>;
type Holiday = { id: string; name: string; date: string };

const defaultSchedule = (): WeekSchedule =>
  Object.fromEntries(
    DAYS.map((d) => [
      d,
      {
        open: d !== 'Saturday' && d !== 'Sunday',
        start: '09:00',
        end: '18:00',
      },
    ]),
  );

export default function BusinessHoursPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [timezone, setTimezone] = useState('UTC');
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [offlineMsg, setOfflineMsg] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayDraft, setHolidayDraft] = useState<{
    name: string;
    date: string;
  }>({ name: '', date: '' });

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getBusinessHours(String(activeProject._id));
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      if (res.hours) {
        setTimezone(res.hours.timezone || 'UTC');
        setOfflineMsg(res.hours.offlineMessage || '');
        if (res.hours.schedule && typeof res.hours.schedule === 'object') {
          setSchedule((prev) => ({ ...prev, ...res.hours.schedule }));
        }
        if (Array.isArray((res.hours as any).holidays)) {
          setHolidays((res.hours as any).holidays as Holiday[]);
        }
      }
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('projectId', String(activeProject?._id ?? ''));
    fd.set('timezone', timezone);
    fd.set('offlineMessage', offlineMsg);
    fd.set('schedule', JSON.stringify(schedule));
    fd.set('holidays', JSON.stringify(holidays));
    const res = await saveBusinessHours(null, fd);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        tone: 'danger',
      });
      return;
    }
    toast({ title: res.message });
  };

  const openHolidayDialog = (h: Holiday | null) => {
    if (h) {
      setEditingHoliday(h);
      setHolidayDraft({ name: h.name, date: h.date });
    } else {
      setEditingHoliday({ id: '', name: '', date: '' });
      setHolidayDraft({ name: '', date: '' });
    }
  };

  const saveHoliday = () => {
    if (!holidayDraft.name.trim() || !holidayDraft.date) return;
    if (editingHoliday && editingHoliday.id) {
      setHolidays((prev) =>
        prev.map((h) =>
          h.id === editingHoliday.id ? { ...h, ...holidayDraft } : h,
        ),
      );
    } else {
      setHolidays((prev) => [
        ...prev,
        { id: crypto.randomUUID(), ...holidayDraft },
      ]);
    }
    setEditingHoliday(null);
  };

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Business hours' },
      ]}
      title="Business hours"
      description="Set your operating hours, holidays, and offline auto-reply message."
      width="narrow"
    >
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Timezone */}
        <Card padding="lg">
          <Field label="Timezone">
            <Select
              value={timezone}
              onChange={(v) => setTimezone(v ?? 'UTC')}
              options={TIMEZONES}
              placeholder="Select timezone"
              className="mt-2 w-72"
            />
          </Field>
        </Card>

        {/* Weekly schedule */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Weekly schedule</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {DAYS.map((day) => {
                const d = schedule[day];
                return (
                  <Card
                    key={day}
                    variant="outlined"
                    padding="sm"
                    className="flex flex-wrap items-center gap-4"
                  >
                    <span className="w-24 text-[13px]">{day}</span>
                    <Switch
                      checked={d.open}
                      onCheckedChange={(v) => updateDay(day, { open: v })}
                      aria-label={`${day} open`}
                    />
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                      {d.open ? 'Open' : 'Closed'}
                    </span>
                    {d.open && (
                      <>
                        <Select
                          value={d.start}
                          onChange={(v) => updateDay(day, { start: v ?? d.start })}
                          options={TIME_OPTIONS}
                          aria-label={`${day} opening time`}
                          className="w-28"
                        />
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                          to
                        </span>
                        <Select
                          value={d.end}
                          onChange={(v) => updateDay(day, { end: v ?? d.end })}
                          options={TIME_OPTIONS}
                          aria-label={`${day} closing time`}
                          className="w-28"
                        />
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Holidays */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Holidays</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              iconLeft={Plus}
              onClick={() => openHolidayDialog(null)}
            >
              Add holiday
            </Button>
          </CardHeader>
          <CardBody>
            {holidays.length === 0 ? (
              <EmptyState
                size="sm"
                icon={CalendarOff}
                title="No holidays added"
                description="Add observed holidays so auto-replies kick in even on closed days."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {holidays.map((h) => (
                  <Card
                    key={h.id}
                    variant="outlined"
                    padding="sm"
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px]">{h.name}</div>
                      <div className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {h.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openHolidayDialog(h)}
                      >
                        Edit
                      </Button>
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        label="Remove holiday"
                        icon={Trash2}
                        onClick={() => removeHoliday(h.id)}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Offline message */}
        <Card padding="lg">
          <Field label="Offline message">
            <Textarea
              id="offline-msg"
              value={offlineMsg}
              onChange={(e) => setOfflineMsg(e.target.value)}
              rows={3}
              placeholder="e.g. Thanks for reaching out! We are currently offline and will get back to you during business hours."
              className="mt-2"
            />
          </Field>
        </Card>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={isPending}
            iconLeft={isPending ? Loader2 : Save}
          >
            {isPending ? 'Saving…' : 'Save business hours'}
          </Button>
        </div>
      </form>

      {/* ── Edit holiday dialog ── */}
      <Modal
        open={!!editingHoliday}
        onClose={() => setEditingHoliday(null)}
        title={editingHoliday?.id ? 'Edit holiday' : 'Add holiday'}
        description="Holidays apply across every connected WhatsApp number."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingHoliday(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={saveHoliday}
              disabled={!holidayDraft.name.trim() || !holidayDraft.date}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              id="holiday-name"
              value={holidayDraft.name}
              onChange={(e) =>
                setHolidayDraft((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="New Year's Day"
            />
          </Field>
          <Field label="Date">
            <Input
              id="holiday-date"
              type="date"
              value={holidayDraft.date}
              onChange={(e) =>
                setHolidayDraft((prev) => ({
                  ...prev,
                  date: e.target.value,
                }))
              }
            />
          </Field>
        </div>
      </Modal>
    </WachatPage>
  );
}
