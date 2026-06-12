'use client';

/**
 * /sabcrm/20ui/record-detail — RecordDetail QA showcase.
 *
 * Renders the RecordSurface detail composites (RecordDetail = header +
 * RecordPanel + RecordTabs) against a fake "company" record, proving:
 *
 *   1. Inline edit — click any field value (or the title) to edit; commits
 *      land in local state after a simulated 600ms round-trip, with the
 *      optimistic value + saving spinner visible while pending.
 *   2. Mixed field types — TEXT / LINK / SELECT / MULTI_SELECT / CURRENCY /
 *      NUMBER / DATE / DATE_TIME / BOOLEAN / RATING / EMAIL / PHONE /
 *      ADDRESS / RELATION all render through RecordCell.
 *   3. Tabs — Timeline (TimelineList, 8 mixed items), Notes + Files
 *      placeholders; flipping tabs keeps state (lazy mount + keepMounted).
 *   4. Favorite star toggle + actions dropdown stub.
 *   5. Responsive — below ~900px the panel collapses above the tabs.
 */

import * as React from 'react';
import { Activity, Copy, Download, Paperclip, StickyNote, Trash2 } from 'lucide-react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import { RecordDetail } from '@/components/sabcrm/20ui/composites/record/record-detail';
import {
  TimelineList,
  type RecordDetailTab,
  type TimelineItem,
} from '@/components/sabcrm/20ui/composites/record/record-tabs';
import type { RelationResolver } from '@/components/sabcrm/20ui/composites/record/record-cell';
import { Button } from '@/components/sabcrm/20ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/sabcrm/20ui/dropdown';

/* ----------------------------------------------------------- fake schema */

const DEMO_OBJECT: ObjectMetadata = {
  slug: 'companies',
  labelSingular: 'Company',
  labelPlural: 'Companies',
  icon: 'Building2',
  fields: [],
  views: ['table'],
};

const DEMO_FIELDS: FieldMetadata[] = [
  { key: 'name', label: 'Name', type: 'TEXT', isLabel: true },
  { key: 'domain', label: 'Domain', type: 'LINK' },
  {
    key: 'industry',
    label: 'Industry',
    type: 'SELECT',
    options: [
      { value: 'saas', label: 'SaaS', color: 'blue' },
      { value: 'fintech', label: 'Fintech', color: 'green' },
      { value: 'health', label: 'Healthcare', color: 'rose' },
      { value: 'retail', label: 'Retail', color: 'amber' },
    ],
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'MULTI_SELECT',
    options: [
      { value: 'priority', label: 'Priority' },
      { value: 'partner', label: 'Partner' },
      { value: 'beta', label: 'Beta' },
      { value: 'churn-risk', label: 'Churn risk' },
    ],
  },
  { key: 'arr', label: 'ARR', type: 'CURRENCY' },
  { key: 'employees', label: 'Employees', type: 'NUMBER' },
  { key: 'founded', label: 'Founded', type: 'DATE' },
  { key: 'nextReview', label: 'Next review', type: 'DATE_TIME' },
  { key: 'active', label: 'Active', type: 'BOOLEAN' },
  { key: 'rating', label: 'Rating', type: 'RATING' },
  { key: 'contactEmail', label: 'Contact email', type: 'EMAIL' },
  { key: 'phone', label: 'Phone', type: 'PHONE' },
  { key: 'address', label: 'Address', type: 'ADDRESS' },
  {
    key: 'owner',
    label: 'Account owner',
    type: 'RELATION',
    relation: { targetObject: 'people', kind: 'MANY_TO_ONE', labelField: 'name' },
  },
];

const INITIAL_RECORD: CrmRecord = {
  _id: 'demo-acme-1',
  object: 'companies',
  userId: 'demo-user',
  createdAt: '2025-11-02T09:30:00.000Z',
  updatedAt: '2026-06-10T16:45:00.000Z',
  data: {
    name: 'Acme Robotics',
    domain: 'acmerobotics.io',
    industry: 'saas',
    tags: ['priority', 'partner'],
    arr: { amount: 482_000, currencyCode: 'USD' },
    employees: 214,
    founded: '2017-03-14',
    nextReview: '2026-07-01T15:30:00.000Z',
    active: true,
    rating: 4,
    contactEmail: 'ops@acmerobotics.io',
    phone: '+1 415 555 0134',
    address: {
      street: '500 Harrison St',
      city: 'San Francisco',
      state: 'CA',
      postcode: '94105',
      country: 'United States',
    },
    owner: 'person-rhea',
  },
};

/** Fake "people" directory backing the RELATION field. */
const PEOPLE: Record<string, string> = {
  'person-rhea': 'Rhea Kapoor',
  'person-omar': 'Omar Haddad',
  'person-june': 'June Park',
};

const RELATION_RESOLVER: RelationResolver = {
  label: (_field, value) => {
    const id = typeof value === 'string' ? value : '';
    return PEOPLE[id] ?? null;
  },
  search: async (_field, q) =>
    Object.entries(PEOPLE)
      .filter(([, name]) => name.toLowerCase().includes(q.toLowerCase()))
      .map(([id, label]) => ({ id, label })),
};

/* ------------------------------------------------------------- timeline */

const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3_600_000);

const TIMELINE_ITEMS: TimelineItem[] = [
  {
    id: 't1',
    kind: 'note',
    title: 'Renewal call recap',
    meta: 'Acme wants the usage dashboard before signing the expansion.',
    at: hoursAgo(2),
    actor: { name: 'Rhea Kapoor' },
  },
  {
    id: 't2',
    kind: 'task',
    title: 'Send revised proposal',
    meta: 'Due Friday — include the multi-region SKU.',
    at: hoursAgo(7),
    actor: { name: 'Omar Haddad' },
  },
  {
    id: 't3',
    kind: 'email',
    title: 'Re: Q3 expansion pricing',
    meta: 'ops@acmerobotics.io · 3 messages in thread',
    at: hoursAgo(26),
    actor: { name: 'June Park' },
  },
  {
    id: 't4',
    kind: 'call',
    title: 'Discovery call with platform team',
    meta: '32 min · positive on rollout timeline',
    at: hoursAgo(50),
    actor: { name: 'Rhea Kapoor' },
  },
  {
    id: 't5',
    kind: 'meeting',
    title: 'Quarterly business review',
    meta: 'On-site, 6 attendees',
    at: hoursAgo(26 * 24),
    actor: { name: 'Omar Haddad' },
  },
  {
    id: 't6',
    kind: 'event',
    title: 'Plan upgraded to Scale',
    at: hoursAgo(31 * 24),
  },
  {
    id: 't7',
    kind: 'system',
    title: 'Record enriched from acmerobotics.io',
    meta: 'Employees, industry and address auto-filled.',
    at: hoursAgo(40 * 24),
  },
  {
    id: 't8',
    kind: 'note',
    title: 'Imported from CSV',
    at: hoursAgo(52 * 24),
    actor: { name: 'June Park' },
  },
];

/* ----------------------------------------------------------- placeholders */

function PlaceholderTab({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}): React.JSX.Element {
  return (
    <div className="rd-empty">
      <span className="rd-empty__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="rd-empty__title">{title}</span>
      <span className="rd-empty__hint">{hint}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export default function RecordDetailShowcasePage(): React.JSX.Element {
  const [record, setRecord] = React.useState<CrmRecord>(INITIAL_RECORD);
  const [favorite, setFavorite] = React.useState(false);
  const [lastAction, setLastAction] = React.useState<string | null>(null);

  // Simulated round-trip: the optimistic value + spinner show while pending,
  // then the commit lands in local state (the "server" echo).
  const handleFieldCommit = React.useCallback(
    async (key: string, next: unknown) => {
      await new Promise((r) => setTimeout(r, 600));
      setRecord((prev) => ({
        ...prev,
        data: { ...prev.data, [key]: next },
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const toggleFavorite = React.useCallback(() => setFavorite((v) => !v), []);

  const tabs = React.useMemo<RecordDetailTab[]>(
    () => [
      {
        id: 'timeline',
        label: 'Timeline',
        icon: Activity,
        badge: TIMELINE_ITEMS.length,
        content: <TimelineList items={TIMELINE_ITEMS} />,
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: StickyNote,
        content: (
          <PlaceholderTab
            icon={<StickyNote size={18} />}
            title="No notes yet"
            hint="Capture context, meeting recaps and reminders here."
          />
        ),
      },
      {
        id: 'files',
        label: 'Files',
        icon: Paperclip,
        content: (
          <PlaceholderTab
            icon={<Paperclip size={18} />}
            title="No files yet"
            hint="Files attached to this record's notes and activities show up here."
          />
        ),
      },
    ],
    [],
  );

  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem iconLeft={Copy} onSelect={() => setLastAction('Copied link')}>
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem iconLeft={Download} onSelect={() => setLastAction('Exported record')}>
          Export
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="danger"
          iconLeft={Trash2}
          onSelect={() => setLastAction('Delete requested (stub)')}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className="20ui"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--st-space-4)',
        padding: 'var(--st-space-5)',
        height: '100vh',
        boxSizing: 'border-box',
        fontFamily: 'var(--st-font)',
        color: 'var(--st-text)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 'none' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          RecordDetail showcase
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--st-font-size-sm)', color: 'var(--st-text-secondary)' }}>
          Click the title or any field to edit (commits after a simulated 600ms).
          {lastAction ? ` · Last action: ${lastAction}` : ''}
        </p>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid var(--st-border)',
          borderRadius: 'var(--st-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <RecordDetail
          object={DEMO_OBJECT}
          record={record}
          fields={DEMO_FIELDS}
          titleFieldKey="name"
          onFieldCommit={handleFieldCommit}
          relationResolver={RELATION_RESOLVER}
          tabs={tabs}
          defaultTabId="timeline"
          header={{
            onBack: () => setLastAction('Back pressed'),
            breadcrumb: 'Companies / Acme Robotics',
            actions,
            isFavorite: favorite,
            onToggleFavorite: toggleFavorite,
          }}
        />
      </div>
    </div>
  );
}
