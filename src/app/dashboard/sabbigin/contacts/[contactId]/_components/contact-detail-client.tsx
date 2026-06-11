'use client';

/**
 * SabBigin contact detail — client island.
 *
 * Native, fully-editable contact record:
 *   - header (avatar, name, company) with an inline-editable name,
 *   - an inline-editable field panel (email/phone/company/job title/…)
 *     saving through `patchSabbiginContact`,
 *   - a notes composer wired to `addCrmNote` via `useActionState`,
 *   - the activity timeline, and a related-deals list.
 */

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Handshake,
  Mail,
  Pencil,
  Phone,
  Radar,
  Tag,
  type LucideIcon,
} from 'lucide-react';

import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  TabsBar,
  TabPanel,
  Textarea,
  toast,
} from '@/components/sabcrm/20ui';

import {
  formatCurrency,
  badgeToneForStage,
} from '@/components/sabbigin/lib/format';
import {
  EntityTimeline,
  type TimelineItem,
} from '@/components/sabbigin/timeline/entity-timeline';

import { patchSabbiginContact } from '@/app/actions/sabbigin-contacts.actions';
import { addCrmNote } from '@/app/actions/crm.actions';
import type { SabbiginContactDeal } from '@/app/actions/sabbigin-contacts.actions';

export interface ContactDetailProps {
  contactId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: string;
  source: string;
  timeline: TimelineItem[];
  deals: SabbiginContactDeal[];
}

type ContactFieldKey =
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'status'
  | 'source';

const FIELD_META: Record<
  ContactFieldKey,
  { label: string; icon: LucideIcon; type?: string; placeholder?: string }
> = {
  email: { label: 'Email', icon: Mail, type: 'email', placeholder: 'name@company.com' },
  phone: { label: 'Phone', icon: Phone, type: 'tel', placeholder: '+91 98765 43210' },
  company: { label: 'Company', icon: Building2, placeholder: 'Acme Corp' },
  jobTitle: { label: 'Job title', icon: Briefcase, placeholder: 'Head of Ops' },
  status: { label: 'Status', icon: Tag, placeholder: 'e.g. qualified' },
  source: { label: 'Source', icon: Radar, placeholder: 'e.g. referral' },
};

const noteInitial: {
  message?: string;
  error?: string;
  note?: { content: string; author: string; createdAt: string };
} = {};

export function ContactDetailClient(props: ContactDetailProps): React.JSX.Element {
  const router = useRouter();
  const [tab, setTab] = React.useState('details');

  const [name, setName] = React.useState(props.name);
  const [editingName, setEditingName] = React.useState(false);

  const [fields, setFields] = React.useState<Record<ContactFieldKey, string>>({
    email: props.email,
    phone: props.phone,
    company: props.company,
    jobTitle: props.jobTitle,
    status: props.status,
    source: props.source,
  });
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>(props.timeline);

  // notes composer (useActionState)
  const [noteState, noteAction, notePending] = useActionState(addCrmNote, noteInitial);
  const noteFormRef = React.useRef<HTMLFormElement>(null);
  const lastNoteRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (noteState?.note && noteState.note.createdAt !== lastNoteRef.current) {
      lastNoteRef.current = noteState.note.createdAt;
      setTimeline((prev) => [
        {
          id: `note-${noteState.note!.createdAt}`,
          type: 'note',
          title: 'Note added',
          body: noteState.note!.content,
          timestamp: noteState.note!.createdAt,
          actorName: noteState.note!.author,
        },
        ...prev,
      ]);
      noteFormRef.current?.reset();
      toast.success({ title: 'Note added' });
      router.refresh();
    } else if (noteState?.error) {
      toast.error({ title: 'Could not add note', description: noteState.error });
    }
  }, [noteState, router]);

  const saveName = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === props.name) {
      setEditingName(false);
      setName(props.name);
      return;
    }
    setSavingKey('name');
    const r = await patchSabbiginContact(props.contactId, { name: trimmed });
    setSavingKey(null);
    setEditingName(false);
    if (!r.success) {
      toast.error({ title: 'Could not rename contact', description: r.error });
      setName(props.name);
      return;
    }
    toast.success({ title: 'Contact renamed' });
    router.refresh();
  }, [name, props.name, props.contactId, router]);

  const saveField = React.useCallback(
    async (key: ContactFieldKey) => {
      const next = fields[key];
      const original = (props as unknown as Record<string, unknown>)[key] as string;
      if ((next ?? '') === (original ?? '')) return;
      setSavingKey(key);
      const r = await patchSabbiginContact(props.contactId, { [key]: next });
      setSavingKey(null);
      if (!r.success) {
        toast.error({ title: 'Could not save', description: r.error });
        setFields((f) => ({ ...f, [key]: original ?? '' }));
        return;
      }
      toast.success({ title: `${FIELD_META[key].label} saved` });
      router.refresh();
    },
    [fields, props, router],
  );

  const tabItems = [
    { value: 'details', label: 'Details', icon: Pencil as LucideIcon },
    {
      value: 'timeline',
      label: 'Timeline',
      icon: Radar as LucideIcon,
      badge: timeline.length || undefined,
    },
    {
      value: 'deals',
      label: 'Deals',
      icon: Handshake as LucideIcon,
      badge: props.deals.length || undefined,
    },
    { value: 'notes', label: 'Notes', icon: Tag as LucideIcon },
  ];

  return (
    <div className="flex w-full flex-col gap-5">
      {/* ── header card ─────────────────────────────────────────────── */}
      <Card padding="none">
        <CardHeader>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={name} size="md" shape="round" />
            <div className="min-w-0 flex-1">
              {editingName ? (
                <Input
                  autoFocus
                  inputSize="sm"
                  value={name}
                  aria-label="Contact name"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveName();
                    } else if (e.key === 'Escape') {
                      setEditingName(false);
                      setName(props.name);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="group flex items-center gap-1.5 text-left"
                  onClick={() => setEditingName(true)}
                >
                  <CardTitle>{name}</CardTitle>
                  <Pencil
                    size={13}
                    className="opacity-0 transition-opacity group-hover:opacity-60"
                    aria-hidden="true"
                  />
                </button>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                {fields.company ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={12} aria-hidden="true" />
                    {fields.company}
                  </span>
                ) : null}
                {fields.email ? (
                  <a
                    href={`mailto:${fields.email}`}
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <Mail size={12} aria-hidden="true" />
                    {fields.email}
                  </a>
                ) : null}
                {fields.phone ? (
                  <a
                    href={`tel:${fields.phone}`}
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <Phone size={12} aria-hidden="true" />
                    {fields.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          {fields.status ? (
            <Badge tone="neutral" kind="soft">
              {fields.status}
            </Badge>
          ) : null}
        </CardHeader>
      </Card>

      {/* ── tabbed body ─────────────────────────────────────────────── */}
      <Card padding="none">
        <TabsBar items={tabItems} value={tab} onChange={setTab} idBase="contact-detail">
          {/* Details — inline-editable fields */}
          <TabPanel value="details">
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              {(Object.keys(FIELD_META) as ContactFieldKey[]).map((key) => {
                const meta = FIELD_META[key];
                return (
                  <Field key={key} label={meta.label}>
                    <Input
                      type={meta.type ?? 'text'}
                      value={fields[key]}
                      placeholder={meta.placeholder}
                      disabled={savingKey === key}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, [key]: e.target.value }))
                      }
                      onBlur={() => void saveField(key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </Field>
                );
              })}
            </div>
          </TabPanel>

          {/* Timeline */}
          <TabPanel value="timeline">
            <div className="p-4">
              <EntityTimeline items={timeline} />
            </div>
          </TabPanel>

          {/* Related deals */}
          <TabPanel value="deals">
            <div className="p-4">
              {props.deals.length === 0 ? (
                <EmptyState
                  icon={Handshake}
                  title="No deals yet"
                  description="Deals linked to this contact will appear here."
                  size="sm"
                  action={
                    <Link
                      href={`/dashboard/sabbigin/deals/new`}
                      className="u-btn u-btn--primary u-btn--sm"
                    >
                      <span className="u-btn__label">New deal</span>
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--st-border)] rounded-[var(--st-radius)] border border-[var(--st-border)]">
                  {props.deals.map((d) => (
                    <li key={d._id}>
                      <Link
                        href={`/dashboard/sabbigin/deals/${d._id}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--st-bg-subtle)]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Handshake
                            size={14}
                            className="shrink-0 text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm font-medium text-[var(--st-text)]">
                            {d.name}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={badgeToneForStage(d.stage)} kind="soft">
                            {d.stage}
                          </Badge>
                          <span className="text-sm tabular-nums text-[var(--st-text-secondary)]">
                            {formatCurrency(d.value, d.currency)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabPanel>

          {/* Notes */}
          <TabPanel value="notes">
            <div className="flex flex-col gap-4 p-4">
              <form ref={noteFormRef} action={noteAction} className="flex flex-col gap-2">
                <input type="hidden" name="recordId" value={props.contactId} />
                <input type="hidden" name="recordType" value="contact" />
                <Field label="Add a note">
                  <Textarea
                    name="noteContent"
                    rows={3}
                    required
                    placeholder="Log a conversation, a preference, a follow-up…"
                  />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm" loading={notePending}>
                    Add note
                  </Button>
                </div>
              </form>

              <div className="border-t border-[var(--st-border)] pt-4">
                <EntityTimeline
                  items={timeline.filter((t) => {
                    const type = String(t.type ?? '').toLowerCase();
                    return type === 'note' || type === 'comment';
                  })}
                  emptyTitle="No notes yet"
                  emptyDescription="Notes you add appear here and in the timeline."
                />
              </div>
            </div>
          </TabPanel>
        </TabsBar>
      </Card>
    </div>
  );
}

export default ContactDetailClient;
