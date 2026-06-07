'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
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

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  Active: 'success',
  Draft: 'warning',
  Paused: 'neutral',
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
  const { toast } = useToast();
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
    { label: 'Updated today', value: rows.filter((row) => row.updatedAt === 'Today').length.toString() },
  ];

  const addRecord = () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: 'Name required', description: 'Enter a name before adding a record.', tone: 'warning' });
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
    setNotes('');
    toast({ title: 'Added', description: `${name} was added to ${title}.`, tone: 'success' });
  };

  const removeRecord = (id: string) => {
    const next = rows.filter((row) => row.id !== id);
    setRows(next);
    saveRecords(storageKey, next);
    toast({ title: 'Removed', description: 'The record was removed.', tone: 'neutral' });
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
      <PageHeader>
        <PageHeaderHeading>
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] text-white"
              style={{ background: accent }}
              aria-hidden="true"
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <PageEyebrow>{eyebrow}</PageEyebrow>
              <PageTitle>{title}</PageTitle>
              <PageDescription>{description}</PageDescription>
            </div>
          </div>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" size="sm" iconLeft={Download} onClick={exportCsv}>
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={() => {
              setRows(records);
              saveRecords(storageKey, records);
              toast({ title: 'Refreshed', description: 'Sample workspace data restored.', tone: 'neutral' });
            }}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardBody>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    iconLeft={Search}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search records"
                    aria-label="Search records"
                  />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Owner</Th>
                    <Th>Status</Th>
                    <Th>Channel</Th>
                    <Th>Updated</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-medium">{row.name}</Td>
                      <Td>{row.owner}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
                          {row.status}
                        </Badge>
                      </Td>
                      <Td>{row.channel}</Td>
                      <Td>{row.updatedAt}</Td>
                      <Td align="right">
                        <IconButton
                          label={`Remove ${row.name}`}
                          icon={Trash2}
                          variant="ghost"
                          onClick={() => removeRecord(row.id)}
                        />
                      </Td>
                    </Tr>
                  ))}
                  {filtered.length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>
                        <EmptyState
                          icon={Search}
                          title="No records match"
                          description="No records match the current filters. Adjust the search or status filter to see more."
                          size="sm"
                        />
                      </Td>
                    </Tr>
                  ) : null}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold text-[var(--st-text)]">{primaryActionLabel}</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Field label="Name">
                  <Input value={newName} onChange={(event) => setNewName(event.target.value)} />
                </Field>
                <Field label="Notes" help="Internal note, audience rule, or setup detail.">
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Internal note, audience rule, setup detail"
                    rows={4}
                  />
                </Field>
                <Button variant="primary" iconLeft={CheckCircle2} onClick={addRecord}>
                  Save record
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Settings</h2>
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {settings.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--st-text)]">{item.label}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
                        {item.description}
                      </p>
                    </div>
                    <Switch
                      aria-label={item.label}
                      checked={enabled[item.label] ?? false}
                      onCheckedChange={(checked) =>
                        setEnabled((prev) => ({ ...prev, [item.label]: checked }))
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  iconLeft={Save}
                  onClick={() =>
                    toast({ title: 'Settings saved', description: `${title} preferences updated.`, tone: 'success' })
                  }
                >
                  Save settings
                </Button>
              </div>
            </CardBody>
          </Card>

          {quickLinks.length ? (
            <Card>
              <CardBody>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Shortcuts</h2>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {quickLinks.map((link) => (
                    <Button
                      key={link.href}
                      variant="ghost"
                      iconLeft={ExternalLink}
                      className="justify-start"
                      onClick={() => {
                        window.location.href = link.href;
                      }}
                    >
                      {link.label}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
