'use client';

/**
 * SabCRM — Booking links settings (`/dashboard/settings/crm/booking`).
 *
 * A two-pane editor (mirrors `../scoring/page.tsx`):
 *
 *   LEFT  — the project's booking links. Each row shows the name, its public
 *           slug, duration and an enabled/off badge. "New" starts a draft.
 *
 *   RIGHT — the editor for the selected link: name, slug, the object a booking
 *           creates a record on, meeting duration, timezone, how far ahead it's
 *           bookable, a per-weekday availability grid, and a Google-Calendar
 *           busy-merge toggle. The public booking URL (`/share/book/<slug>`)
 *           is shown with a copy button once saved.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import {
  Plus,
  Trash2,
  CalendarClock,
  Save,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Textarea,
  Switch,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listBookingLinksTw,
  saveBookingLinkTw,
  deleteBookingLinkTw,
} from '@/app/actions/sabcrm-booking.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { BookingLink } from '@/lib/sabcrm/booking.server';
import type {
  WeeklyAvailability,
  AvailabilityWindow,
} from '@/lib/sabcrm/booking';

// ---------------------------------------------------------------------------
// Local wire shapes (kept free of any server-only import)
// ---------------------------------------------------------------------------

interface ObjectOption {
  value: string;
  label: string;
}

const WEEKDAYS: ReadonlyArray<{ idx: number; label: string }> = [
  { idx: 1, label: 'Monday' },
  { idx: 2, label: 'Tuesday' },
  { idx: 3, label: 'Wednesday' },
  { idx: 4, label: 'Thursday' },
  { idx: 5, label: 'Friday' },
  { idx: 6, label: 'Saturday' },
  { idx: 0, label: 'Sunday' },
];

const DURATIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '90', label: '90 minutes' },
];

/** An editable booking-link draft — `id` absent until first saved. */
interface DraftLink {
  id?: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  durationMins: number;
  weeklyAvailability: WeeklyAvailability;
  tz: string;
  objectSlug: string;
  rangeDays: number;
  pushCalendar: boolean;
}

function guessTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function defaultAvailability(): WeeklyAvailability {
  const win: AvailabilityWindow[] = [{ start: '09:00', end: '17:00' }];
  return { 1: win, 2: win, 3: win, 4: win, 5: win };
}

function emptyDraft(objectSlug = 'people'): DraftLink {
  return {
    slug: '',
    name: 'New meeting',
    description: '',
    enabled: true,
    durationMins: 30,
    weeklyAvailability: defaultAvailability(),
    tz: guessTz(),
    objectSlug,
    rangeDays: 30,
    pushCalendar: true,
  };
}

function publicUrl(slug: string): string {
  if (typeof window === 'undefined') return `/share/book/${slug}`;
  return `${window.location.origin}/share/book/${slug}`;
}

export default function BookingSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [links, setLinks] = React.useState<BookingLink[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftLink | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [linksRes, objsRes] = await Promise.all([
        listBookingLinksTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (linksRes.ok) setLinks(linksRes.data);
      else setError(linksRes.error);
      if (objsRes.ok) {
        setObjects(
          objsRes.data.map((o) => ({
            value: o.slug,
            label: o.labelPlural || o.slug,
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function selectLink(link: BookingLink): void {
    setSelectedId(link.id);
    setDraft({
      id: link.id,
      slug: link.slug,
      name: link.name,
      description: link.description ?? '',
      enabled: link.enabled,
      durationMins: link.durationMins,
      weeklyAvailability: link.weeklyAvailability ?? defaultAvailability(),
      tz: link.tz,
      objectSlug: link.objectSlug,
      rangeDays: link.rangeDays,
      pushCalendar: link.pushCalendar,
    });
  }

  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft(objects[0]?.value ?? 'people'));
  }

  function patchDraft(patch: Partial<DraftLink>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function dayWindow(day: number): AvailabilityWindow | null {
    const wins = draft?.weeklyAvailability[day];
    return wins && wins.length ? wins[0] : null;
  }

  function toggleDay(day: number, on: boolean): void {
    setDraft((d) => {
      if (!d) return d;
      const wa = { ...d.weeklyAvailability };
      if (on) wa[day] = [{ start: '09:00', end: '17:00' }];
      else delete wa[day];
      return { ...d, weeklyAvailability: wa };
    });
  }

  function patchDayTime(day: number, patch: Partial<AvailabilityWindow>): void {
    setDraft((d) => {
      if (!d) return d;
      const wa = { ...d.weeklyAvailability };
      const cur = wa[day]?.[0] ?? { start: '09:00', end: '17:00' };
      wa[day] = [{ ...cur, ...patch }];
      return { ...d, weeklyAvailability: wa };
    });
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    if (!draft.name.trim()) {
      toast({ title: 'Name is required.', tone: 'danger' });
      return;
    }
    if (!draft.objectSlug) {
      toast({ title: 'Pick an object to create.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const res = await saveBookingLinkTw(
      {
        id: draft.id,
        slug: draft.slug || undefined,
        name: draft.name,
        description: draft.description || undefined,
        enabled: draft.enabled,
        durationMins: draft.durationMins,
        weeklyAvailability: draft.weeklyAvailability,
        tz: draft.tz,
        objectSlug: draft.objectSlug,
        rangeDays: draft.rangeDays,
        pushCalendar: draft.pushCalendar,
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Booking link saved', tone: 'success' });
    const listRes = await listBookingLinksTw(activeProjectId);
    if (listRes.ok) setLinks(listRes.data);
    selectLink(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteBookingLinkTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Booking link deleted', tone: 'success' });
  }

  async function copyUrl(): Promise<void> {
    if (!draft?.slug) return;
    try {
      await navigator.clipboard.writeText(publicUrl(draft.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy link', tone: 'danger' });
    }
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Booking links</PageTitle>
          <PageDescription>
            Share a public link that lets people self-book a time. Each booking
            creates a CRM record and a meeting on the timeline, and (when your
            Google Calendar is connected) blocks busy slots and adds the event.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New link
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_1fr]">
        {/* LEFT — list */}
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : links.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No booking links yet"
              description="Create a link to let people self-book a time."
            />
          ) : (
            links.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => selectLink(link)}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedId === link.id
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {link.name}
                  </span>
                  <Badge tone={link.enabled ? 'success' : 'neutral'} kind="soft">
                    {link.enabled ? 'On' : 'Off'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  /{link.slug} · {link.durationMins} min
                </span>
              </button>
            ))
          )}
        </div>

        {/* RIGHT — editor */}
        <div>
          {!draft ? (
            <Card className="p-[var(--st-space-5)]">
              <EmptyState
                icon={CalendarClock}
                title="Select or create a booking link"
                description="Set your availability and what a booking should create in your CRM."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              {/* Public URL */}
              {draft.id && draft.slug && (
                <div className="flex flex-wrap items-center gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-2)]">
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    Public link
                  </span>
                  <code className="flex-1 truncate text-[12px] text-[var(--st-text)]">
                    {publicUrl(draft.slug)}
                  </code>
                  <IconButton
                    icon={copied ? Check : Copy}
                    label="Copy public link"
                    variant="ghost"
                    onClick={copyUrl}
                  />
                  <a
                    href={publicUrl(draft.slug)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open public link"
                  >
                    <IconButton icon={ExternalLink} label="Open" variant="ghost" />
                  </a>
                </div>
              )}

              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. 30-min intro call"
                  />
                </Field>
                <Field label="URL slug" help="Leave blank to derive from the name.">
                  <Input
                    value={draft.slug}
                    onChange={(e) => patchDraft({ slug: e.target.value })}
                    placeholder="intro-call"
                  />
                </Field>
              </div>

              <Field label="Description">
                <Textarea
                  value={draft.description}
                  onChange={(e) => patchDraft({ description: e.target.value })}
                  placeholder="Shown to people on the booking page."
                  rows={2}
                />
              </Field>

              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3">
                <Field label="Duration">
                  <Select
                    value={String(draft.durationMins)}
                    onValueChange={(v) => patchDraft({ durationMins: Number(v) })}
                  >
                    <SelectTrigger aria-label="Duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Creates a">
                  <Select
                    value={draft.objectSlug}
                    onValueChange={(objectSlug) => patchDraft({ objectSlug })}
                  >
                    <SelectTrigger aria-label="Object to create">
                      <SelectValue placeholder="Select an object" />
                    </SelectTrigger>
                    <SelectContent>
                      {objects.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Bookable ahead (days)">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={Number.isFinite(draft.rangeDays) ? draft.rangeDays : 30}
                    onChange={(e) =>
                      patchDraft({ rangeDays: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>

              <Field label="Timezone" help="IANA name, e.g. Asia/Kolkata.">
                <Input
                  value={draft.tz}
                  onChange={(e) => patchDraft({ tz: e.target.value })}
                  placeholder="Asia/Kolkata"
                />
              </Field>

              <div className="flex items-center gap-[var(--st-space-3)]">
                <Switch
                  checked={draft.enabled}
                  aria-label="Enable booking link"
                  onCheckedChange={(enabled) => patchDraft({ enabled })}
                />
                <span className="text-[13px] text-[var(--st-text)]">
                  Enabled — accept public bookings
                </span>
              </div>

              <div className="flex items-center gap-[var(--st-space-3)]">
                <Switch
                  checked={draft.pushCalendar}
                  aria-label="Sync with Google Calendar"
                  onCheckedChange={(pushCalendar) => patchDraft({ pushCalendar })}
                />
                <span className="text-[13px] text-[var(--st-text)]">
                  Google Calendar — block busy slots and add the event (when
                  connected)
                </span>
              </div>

              {/* Weekly availability */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Weekly availability
                </span>
                {WEEKDAYS.map((wd) => {
                  const win = dayWindow(wd.idx);
                  const on = !!win;
                  return (
                    <div
                      key={wd.idx}
                      className="flex flex-wrap items-center gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                    >
                      <div className="flex w-[130px] items-center gap-[var(--st-space-2)]">
                        <Switch
                          checked={on}
                          aria-label={`Available on ${wd.label}`}
                          onCheckedChange={(v) => toggleDay(wd.idx, v)}
                        />
                        <span className="text-[13px] text-[var(--st-text)]">
                          {wd.label}
                        </span>
                      </div>
                      {on ? (
                        <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                          <Field label="From" className="w-[120px]">
                            <Input
                              type="time"
                              value={win?.start ?? '09:00'}
                              onChange={(e) =>
                                patchDayTime(wd.idx, { start: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="To" className="w-[120px]">
                            <Input
                              type="time"
                              value={win?.end ?? '17:00'}
                              onChange={(e) =>
                                patchDayTime(wd.idx, { end: e.target.value })
                              }
                            />
                          </Field>
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

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                <Button
                  variant="primary"
                  iconLeft={Save}
                  onClick={save}
                  loading={saving}
                  disabled={saving}
                >
                  Save
                </Button>
                {draft.id && (
                  <Button
                    variant="ghost"
                    iconLeft={Trash2}
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this booking link?</AlertDialogTitle>
            <AlertDialogDescription>
              The public link will stop working immediately. Records and meetings
              already created from past bookings are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
