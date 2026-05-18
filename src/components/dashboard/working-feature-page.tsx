'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Activity,
  CheckCircle2,
  Download,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  type LucideIcon,
  } from 'lucide-react';

import * as React from 'react';

type FeatureRecord = {
  id: string;
  name: string;
  owner: string;
  status: string;
  channel: string;
  updatedAt: string;
};

export type WorkingFeaturePageProps = {
  title: string;
  description: string;
  eyebrow?: string;
  icon: LucideIcon;
  accent?: string;
  storageKey: string;
  primaryActionLabel?: string;
  records?: FeatureRecord[];
  settings?: {
    label: string;
    description: string;
  }[];
  quickLinks?: {
    label: string;
    href: string;
  }[];
};

const DEFAULT_RECORDS: FeatureRecord[] = [
  {
    id: 'rec-1',
    name: 'Welcome workflow',
    owner: 'Operations',
    status: 'Active',
    channel: 'Automation',
    updatedAt: 'Today',
  },
  {
    id: 'rec-2',
    name: 'Follow-up queue',
    owner: 'Sales',
    status: 'Draft',
    channel: 'CRM',
    updatedAt: 'Yesterday',
  },
  {
    id: 'rec-3',
    name: 'Weekly performance review',
    owner: 'Marketing',
    status: 'Paused',
    channel: 'Analytics',
    updatedAt: 'This week',
  },
];

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'secondary'> = {
  Active: 'success',
  Draft: 'warning',
  Paused: 'secondary',
};

function readRecords(key: string, fallback: FeatureRecord[]) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveRecords(key: string, records: FeatureRecord[]) {
  window.localStorage.setItem(key, JSON.stringify(records));
}

export function WorkingFeaturePage({
  title,
  description,
  eyebrow = 'Workspace module',
  icon: Icon,
  accent = '#2563EB',
  storageKey,
  primaryActionLabel = 'Add item',
  records = DEFAULT_RECORDS,
  settings = [
    {
      label: 'Approval required',
      description: 'New records stay in draft until an owner reviews them.',
    },
    {
      label: 'Notify team',
      description: 'Send alerts when a record changes status.',
    },
    {
      label: 'Sync reports',
      description: 'Include this module in dashboard rollups.',
    },
  ],
  quickLinks = [],
}: WorkingFeaturePageProps) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<FeatureRecord[]>(records);
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [newName, setNewName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(settings.map((item) => [item.label, true])),
  );

  React.useEffect(() => {
    setRows(readRecords(storageKey, records));
  }, [records, storageKey]);

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      row.name.toLowerCase().includes(q) ||
      row.owner.toLowerCase().includes(q) ||
      row.channel.toLowerCase().includes(q);
    const matchesStatus = status === 'all' || row.status === status;
    return matchesQuery && matchesStatus;
  });

  const stats = [
    { label: 'Total', value: rows.length.toString() },
    { label: 'Active', value: rows.filter((row) => row.status === 'Active').length.toString() },
    { label: 'Drafts', value: rows.filter((row) => row.status === 'Draft').length.toString() },
    { label: 'Updated', value: rows.filter((row) => row.updatedAt === 'Today').length.toString() },
  ];

  const addRecord = () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: 'Name required', description: 'Enter a name before adding a record.' });
      return;
    }
    const next = [
      {
        id: `rec-${Date.now()}`,
        name,
        owner: 'Current user',
        status: 'Draft',
        channel: title,
        updatedAt: 'Today',
      },
      ...rows,
    ];
    setRows(next);
    saveRecords(storageKey, next);
    setNewName('');
    toast({ title: 'Added', description: `${name} was added to ${title}.` });
  };

  const removeRecord = (id: string) => {
    const next = rows.filter((row) => row.id !== id);
    setRows(next);
    saveRecords(storageKey, next);
    toast({ title: 'Removed', description: 'The record was removed.' });
  };

  const exportCsv = () => {
    const headers = ['name', 'owner', 'status', 'channel', 'updatedAt'];
    const csv = [
      headers.join(','),
      ...filtered.map((row) =>
        headers.map((field) => JSON.stringify(row[field as keyof FeatureRecord] ?? '')).join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${storageKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: accent }}
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-[24px] font-semibold leading-tight text-zoru-ink">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
              {description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => {
              setRows(records);
              saveRecords(storageKey, records);
              toast({ title: 'Refreshed', description: 'Sample workspace data restored.' });
            }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </ZoruButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <ZoruCard key={item.label} className="p-4">
            <p className="text-[12px] text-zoru-ink-muted">{item.label}</p>
            <p className="mt-2 text-[26px] font-semibold text-zoru-ink">{item.value}</p>
          </ZoruCard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ZoruCard className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                <ZoruInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search records"
                  className="pl-9"
                />
              </div>
              <ZoruSelect value={status} onValueChange={setStatus}>
                <ZoruSelectTrigger className="w-full sm:w-44">
                  <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                  <ZoruSelectItem value="Active">Active</ZoruSelectItem>
                  <ZoruSelectItem value="Draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="Paused">Paused</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Name</ZoruTableHead>
                  <ZoruTableHead>Owner</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Channel</ZoruTableHead>
                  <ZoruTableHead>Updated</ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.map((row) => (
                  <ZoruTableRow key={row.id}>
                    <ZoruTableCell className="font-medium">{row.name}</ZoruTableCell>
                    <ZoruTableCell>{row.owner}</ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={STATUS_VARIANT[row.status] ?? 'default'}>
                        {row.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>{row.channel}</ZoruTableCell>
                    <ZoruTableCell>{row.updatedAt}</ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruButton variant="ghost" size="icon" onClick={() => removeRecord(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell colSpan={6} className="h-24 text-center text-zoru-ink-muted">
                      No records match the current filters.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : null}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </ZoruCard>

        <div className="flex flex-col gap-4">
          <ZoruCard className="p-5">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-zoru-ink-muted" />
              <h2 className="text-[15px] font-semibold text-zoru-ink">{primaryActionLabel}</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <ZoruLabel>Name</ZoruLabel>
                <ZoruInput value={newName} onChange={(event) => setNewName(event.target.value)} />
              </div>
              <div>
                <ZoruLabel>Notes</ZoruLabel>
                <ZoruTextarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Internal note, audience rule, setup detail..."
                  rows={4}
                />
              </div>
              <ZoruButton onClick={addRecord}>
                <CheckCircle2 className="h-4 w-4" /> Save record
              </ZoruButton>
            </div>
          </ZoruCard>

          <ZoruCard className="p-5">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-zoru-ink-muted" />
              <h2 className="text-[15px] font-semibold text-zoru-ink">Settings</h2>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {settings.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-zoru-ink">{item.label}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-zoru-ink-muted">
                      {item.description}
                    </p>
                  </div>
                  <ZoruSwitch
                    checked={enabled[item.label] ?? false}
                    onCheckedChange={(checked) =>
                      setEnabled((prev) => ({ ...prev, [item.label]: checked }))
                    }
                  />
                </div>
              ))}
              <ZoruButton
                variant="outline"
                onClick={() => toast({ title: 'Settings saved', description: `${title} preferences updated.` })}
              >
                <Save className="h-4 w-4" /> Save settings
              </ZoruButton>
            </div>
          </ZoruCard>

          {quickLinks.length ? (
            <ZoruCard className="p-5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-zoru-ink-muted" />
                <h2 className="text-[15px] font-semibold text-zoru-ink">Shortcuts</h2>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {quickLinks.map((link) => (
                  <ZoruButton key={link.href} variant="ghost" asChild className="justify-start">
                    <a href={link.href}>
                      <ExternalLink className="h-4 w-4" /> {link.label}
                    </a>
                  </ZoruButton>
                ))}
              </div>
            </ZoruCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
