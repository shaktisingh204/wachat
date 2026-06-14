"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  Download,
  Trash2,
  Copy,
  FolderPlus,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  Hash,
  User,
  Eye,
  Zap,
  FileSignature,
  Layers,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Badge,
  type BadgeTone,
  Field,
  Input,
  Checkbox,
  Card,
  CardBody,
  StatCard,
  SegmentedControl,
  EmptyState,
  Alert,
  Avatar,
  AvatarGroup,
  Tag,
  Skeleton,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';

// --- Types ---
type Recipient = {
  name: string;
  email: string;
  status: 'Signed' | 'Pending' | 'Viewed' | 'Declined';
};

type Envelope = {
  id: string;
  subject: string;
  status: 'Draft' | 'Sent' | 'Delivered' | 'Completed' | 'Declined' | 'Voided' | 'Action Required';
  sender: string;
  recipients: Recipient[];
  lastModified: string;
  created: string;
  size: string;
  tags: string[];
  folder: string;
  isStarred: boolean;
};

function mapEnvelopeStatus(rustStatus: string): Envelope['status'] {
  switch (rustStatus) {
    case 'draft': return 'Draft';
    case 'sent': return 'Sent';
    case 'in_progress': return 'Action Required';
    case 'completed': return 'Completed';
    case 'declined': return 'Declined';
    case 'voided': return 'Voided';
    case 'expired': return 'Voided';
    default: return 'Draft';
  }
}

function mapSignerStatus(rustStatus: string): Recipient['status'] {
  switch (rustStatus) {
    case 'pending':
    case 'notified': return 'Pending';
    case 'viewed': return 'Viewed';
    case 'completed': return 'Signed';
    case 'declined': return 'Declined';
    default: return 'Pending';
  }
}

// --- Status badge mapping (colour only carries status meaning) ---
const STATUS_TONE: Record<Envelope['status'], BadgeTone> = {
  'Completed': 'success',
  'Sent': 'info',
  'Delivered': 'accent',
  'Draft': 'neutral',
  'Declined': 'danger',
  'Voided': 'warning',
  'Action Required': 'warning',
};

const STATUS_ICON: Record<Envelope['status'], React.ReactNode> = {
  'Completed': <CheckCircle className="h-3 w-3" aria-hidden="true" />,
  'Sent': <Send className="h-3 w-3" aria-hidden="true" />,
  'Delivered': <Mail className="h-3 w-3" aria-hidden="true" />,
  'Draft': <FileText className="h-3 w-3" aria-hidden="true" />,
  'Declined': <X className="h-3 w-3" aria-hidden="true" />,
  'Voided': <AlertCircle className="h-3 w-3" aria-hidden="true" />,
  'Action Required': <Zap className="h-3 w-3" aria-hidden="true" />,
};

const StatusBadge = ({ status }: { status: Envelope['status'] }) => (
  <Badge tone={STATUS_TONE[status]} className="inline-flex items-center gap-1">
    {STATUS_ICON[status]}
    {status}
  </Badge>
);

const RECIPIENT_TONE: Record<Recipient['status'], BadgeTone> = {
  'Signed': 'success',
  'Declined': 'danger',
  'Viewed': 'info',
  'Pending': 'neutral',
};

const FOLDERS = ['Inbox', 'Action Required', 'Sent', 'Drafts', 'Completed'] as const;
type Folder = (typeof FOLDERS)[number];

export default function SabSignDashboard() {
  const { toast } = useToast();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/app/actions/sabsign.actions').then(({ listEnvelopes }) => {
      listEnvelopes({ limit: 100 }).then(res => {
        const mapped = res.items.map((doc: any) => ({
          id: doc._id,
          subject: doc.name || doc.subject || 'Untitled',
          status: mapEnvelopeStatus(doc.status),
          sender: doc.userId || 'System',
          recipients: (doc.signers || []).map((s: any) => ({
            name: s.name,
            email: s.email,
            status: mapSignerStatus(s.status)
          })),
          lastModified: doc.updatedAt || doc.createdAt,
          created: doc.createdAt,
          size: '-',
          tags: [],
          folder: doc.status === 'draft' ? 'Drafts' : (doc.status === 'sent' || doc.status === 'in_progress' ? 'Sent' : 'Inbox'),
          isStarred: false
        }));
        setEnvelopes(mapped);
        setLoading(false);
      }).catch(err => {
        console.error('Failed to list envelopes', err);
        setLoading(false);
      });
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<Folder>('Inbox');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedEnvelopes, setSelectedEnvelopes] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [selectedEnvelopeDetail, setSelectedEnvelopeDetail] = useState<Envelope | null>(null);

  // KPI rollups
  const stats = useMemo(() => {
    const pending = envelopes.filter(e => e.status === 'Sent' || e.status === 'Delivered' || e.status === 'Action Required').length;
    const signed = envelopes.filter(e => e.status === 'Completed').length;
    const drafts = envelopes.filter(e => e.status === 'Draft').length;
    return { total: envelopes.length, pending, signed, drafts };
  }, [envelopes]);

  const folderCount = useMemo(() => {
    const count = (f: Folder) => {
      switch (f) {
        case 'Inbox': return envelopes.filter(e => e.folder === 'Inbox' || !['Draft', 'Sent'].includes(e.status)).length;
        case 'Action Required': return envelopes.filter(e => e.status === 'Action Required').length;
        case 'Sent': return envelopes.filter(e => e.status === 'Sent' || e.status === 'Delivered').length;
        case 'Drafts': return envelopes.filter(e => e.status === 'Draft').length;
        case 'Completed': return envelopes.filter(e => e.status === 'Completed').length;
      }
    };
    return Object.fromEntries(FOLDERS.map(f => [f, count(f)])) as Record<Folder, number>;
  }, [envelopes]);

  const filteredEnvelopes = useMemo(() => {
    return envelopes.filter(env => {
      const matchesSearch = env.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            env.id.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFolder = true;
      if (selectedFolder === 'Inbox') matchesFolder = env.folder === 'Inbox' || !['Draft', 'Sent'].includes(env.status);
      else if (selectedFolder === 'Sent') matchesFolder = env.status === 'Sent' || env.status === 'Delivered';
      else if (selectedFolder === 'Drafts') matchesFolder = env.status === 'Draft';
      else if (selectedFolder === 'Action Required') matchesFolder = env.status === 'Action Required';
      else if (selectedFolder === 'Completed') matchesFolder = env.status === 'Completed';

      return matchesSearch && matchesFolder;
    });
  }, [envelopes, searchQuery, selectedFolder]);

  const paginatedEnvelopes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEnvelopes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEnvelopes, currentPage]);

  const totalPages = Math.ceil(filteredEnvelopes.length / itemsPerPage);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedEnvelopes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEnvelopes(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedEnvelopes.size === paginatedEnvelopes.length) {
      setSelectedEnvelopes(new Set());
    } else {
      setSelectedEnvelopes(new Set(paginatedEnvelopes.map(e => e.id)));
    }
  };

  const allSelected = selectedEnvelopes.size === paginatedEnvelopes.length && paginatedEnvelopes.length > 0;
  const someSelected = selectedEnvelopes.size > 0 && !allSelected;

  const handleRowClick = (envelope: Envelope) => setSelectedEnvelopeDetail(envelope);
  const closeDetail = () => setSelectedEnvelopeDetail(null);

  return (
    <main className="flex w-full max-w-7xl flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabSign</PageEyebrow>
          <PageTitle>Envelopes</PageTitle>
          <PageDescription>
            Send documents for signature and track every envelope from draft to
            completion.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline" size="sm">
            <Link href="/sabsign/templates">
              <Layers className="h-4 w-4" aria-hidden="true" />
              Templates
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/sabsign/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New envelope
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {/* KPI strip */}
      <section
        aria-label="Envelope overview"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard label="Total documents" value={stats.total} icon={FileSignature} accent="#6366f1" />
        <StatCard label="Pending signature" value={stats.pending} icon={Clock} />
        <StatCard label="Signed" value={stats.signed} icon={CheckCircle} />
        <StatCard label="Drafts" value={stats.drafts} icon={FileText} />
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          aria-label="Filter envelopes by folder"
          size="sm"
          value={selectedFolder}
          onChange={(v) => { setSelectedFolder(v as Folder); setCurrentPage(1); }}
          items={FOLDERS.map(f => ({
            value: f,
            label: folderCount[f] > 0 ? `${f} (${folderCount[f]})` : f,
          }))}
        />
        <div className="flex items-center gap-2">
          <Field className="w-full sm:w-72">
            <Input
              type="search"
              inputSize="sm"
              iconLeft={Search}
              placeholder="Search envelopes, signers, IDs"
              aria-label="Search envelopes"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </Field>
          <SegmentedControl
            aria-label="View mode"
            size="sm"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'list' | 'grid')}
            items={[
              { value: 'list', label: '', icon: List },
              { value: 'grid', label: '', icon: LayoutGrid },
            ]}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedEnvelopes.size > 0 && (
        <Card variant="outlined" padding="sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[var(--st-text)] tabular-nums">
              {selectedEnvelopes.size} selected
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" iconLeft={Download} onClick={() => toast.success(`${selectedEnvelopes.size} envelope(s) queued for download`)}>Download</Button>
              <Button variant="ghost" size="sm" iconLeft={FolderPlus} onClick={() => toast.info('Pick a destination folder')}>Move</Button>
              <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => toast.error('Delete is not available in this view')}>Delete</Button>
              <IconButton label="Clear selection" icon={X} variant="ghost" size="sm" onClick={() => setSelectedEnvelopes(new Set())} />
            </div>
          </div>
        </Card>
      )}

      {/* Data */}
      {loading ? (
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={64} radius="var(--st-radius-lg)" />
          ))}
        </div>
      ) : filteredEnvelopes.length === 0 ? (
        <EmptyState
          icon={envelopes.length === 0 ? FileSignature : Search}
          tone="info"
          title={envelopes.length === 0 ? 'No envelopes yet' : 'No envelopes match your filters'}
          description={
            envelopes.length === 0
              ? 'Create your first envelope to send a document out for signature.'
              : 'Try a different folder or clear your search to see more.'
          }
          action={
            envelopes.length === 0 ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/sabsign/new">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New envelope
                </Link>
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setSearchQuery(''); setSelectedFolder('Inbox'); setCurrentPage(1); }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : viewMode === 'list' ? (
        <Card variant="outlined" padding="none">
          {/* List header */}
          <div className="grid grid-cols-12 items-center gap-4 border-b border-[var(--st-border)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
            <div className="col-span-5 flex items-center gap-4">
              <Checkbox
                size="sm"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleSelectAll}
                aria-label="Select all envelopes"
              />
              <span>Subject</span>
            </div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Recipients</div>
            <div className="col-span-2 text-right">Last modified</div>
          </div>

          <ul className="divide-y divide-[var(--st-border)]">
            {paginatedEnvelopes.map((env) => (
              <li key={env.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowClick(env)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(env); } }}
                  className={`group grid cursor-pointer grid-cols-12 items-center gap-4 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] ${selectedEnvelopes.has(env.id) ? 'bg-[var(--st-accent-soft)]' : 'hover:bg-[var(--st-bg-muted)]'}`}
                >
                  <div className="col-span-5 flex min-w-0 items-center gap-4">
                    <span onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <Checkbox
                        size="sm"
                        checked={selectedEnvelopes.has(env.id)}
                        onChange={() => toggleSelection(env.id)}
                        aria-label={`Select ${env.subject}`}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--st-text)]">{env.subject}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--st-text-tertiary)]">
                        <span className="truncate font-mono">{env.id}</span>
                        {env.tags.map(tag => (<Tag key={tag}>{tag}</Tag>))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={env.status} />
                  </div>

                  <div className="col-span-3 min-w-0">
                    {env.recipients.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <AvatarGroup max={3} size="sm" shape="round" label={`${env.recipients.length} recipient${env.recipients.length === 1 ? '' : 's'}`}>
                          {env.recipients.map((rec, i) => (
                            <Avatar key={i} name={rec.name} size="sm" shape="round" />
                          ))}
                        </AvatarGroup>
                        <span className="truncate text-xs text-[var(--st-text-tertiary)]">
                          {env.recipients.length === 1 ? env.recipients[0].name : `${env.recipients.length} people`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--st-text-tertiary)]">No recipients</span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <div className="text-right text-xs text-[var(--st-text-secondary)] tabular-nums">
                      {new Date(env.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                    <IconButton label="Quick view" icon={Eye} variant="ghost" size="sm" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleRowClick(env); }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedEnvelopes.map((env) => (
            <Card
              key={env.id}
              variant="interactive"
              padding="md"
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(env)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(env); } }}
              className={`relative flex cursor-pointer flex-col ${selectedEnvelopes.has(env.id) ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]' : ''}`}
            >
              <span className="absolute right-4 top-4 z-10" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  size="sm"
                  checked={selectedEnvelopes.has(env.id)}
                  onChange={() => toggleSelection(env.id)}
                  aria-label={`Select ${env.subject}`}
                />
              </span>

              <StatusBadge status={env.status} />
              <h3 className="mt-3 line-clamp-2 text-sm font-medium text-[var(--st-text)]">{env.subject}</h3>
              <p className="mt-1 font-mono text-xs text-[var(--st-text-tertiary)]">{env.id}</p>

              <div className="mt-auto pt-4">
                <Separator />
                <div className="flex items-center justify-between pt-3">
                  <AvatarGroup max={3} size="sm" shape="round" label={`${env.recipients.length} recipient${env.recipients.length === 1 ? '' : 's'}`}>
                    {env.recipients.map((rec, i) => (
                      <Avatar key={i} name={rec.name} size="sm" shape="round" />
                    ))}
                  </AvatarGroup>
                  <span className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)] tabular-nums">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {new Date(env.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredEnvelopes.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
          <span className="tabular-nums">
            {Math.min((currentPage - 1) * itemsPerPage + 1, filteredEnvelopes.length)}–{Math.min(currentPage * itemsPerPage, filteredEnvelopes.length)} of {filteredEnvelopes.length}
          </span>
          <div className="flex items-center gap-1">
            <IconButton
              label="Previous page"
              icon={ChevronLeft}
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            />
            <IconButton
              label="Next page"
              icon={ChevronRight}
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            />
          </div>
        </div>
      )}

      {/* Detail flyout */}
      {selectedEnvelopeDetail && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeDetail}
          />
          <aside
            aria-label="Envelope details"
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-lg)] md:w-[480px]"
          >
            <header className="flex items-center justify-between border-b border-[var(--st-border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <IconButton label="Close details" icon={X} variant="ghost" size="sm" onClick={closeDetail} />
                <h2 className="text-base font-semibold text-[var(--st-text)]">Envelope details</h2>
              </div>
              <IconButton label="More options" icon={MoreVertical} variant="ghost" size="sm" />
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div>
                <div className="mb-2 flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold leading-tight text-[var(--st-text)]">{selectedEnvelopeDetail.subject}</h3>
                  <StatusBadge status={selectedEnvelopeDetail.status} />
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--st-text-secondary)]">
                  <span className="flex items-center gap-1"><Hash className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" /> <span className="font-mono">{selectedEnvelopeDetail.id}</span></span>
                  <span className="flex items-center gap-1"><FolderPlus className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" /> {selectedEnvelopeDetail.folder}</span>
                </div>
              </div>

              {selectedEnvelopeDetail.status === 'Action Required' && (
                <Alert tone="warning" title="A signature is required">
                  <p className="mb-3">Review and sign this document to keep it moving.</p>
                  <Button variant="primary" size="sm" onClick={() => toast.info('Opening the signing flow')}>
                    Sign now
                  </Button>
                </Alert>
              )}

              <section>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                  <User className="h-4 w-4" aria-hidden="true" /> Recipients
                </h4>
                {selectedEnvelopeDetail.recipients.length > 0 ? (
                  <ol className="space-y-3">
                    {selectedEnvelopeDetail.recipients.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          {rec.status === 'Signed' ? (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-status-ok)] text-[var(--st-text-inverted)]" aria-hidden="true">
                              <CheckCircle className="h-4 w-4" />
                            </span>
                          ) : (
                            <Avatar name={rec.name} size="md" shape="round" />
                          )}
                          {i < selectedEnvelopeDetail.recipients.length - 1 && (
                            <span className="my-1 h-8 w-px bg-[var(--st-border)]" aria-hidden="true" />
                          )}
                        </div>
                        <Card variant="outlined" padding="sm" className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-[var(--st-text)]">{rec.name}</p>
                            <Badge tone={RECIPIENT_TONE[rec.status]}>{rec.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">{rec.email}</p>
                        </Card>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-[var(--st-text-tertiary)]">No recipients on this envelope.</p>
                )}
              </section>

              <section>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                  <FileText className="h-4 w-4" aria-hidden="true" /> Details
                </h4>
                <Card variant="outlined" padding="none">
                  <dl className="divide-y divide-[var(--st-border)] text-sm">
                    <div className="grid grid-cols-3 gap-4 p-3">
                      <dt className="text-xs text-[var(--st-text-tertiary)]">Sent by</dt>
                      <dd className="col-span-2 text-[var(--st-text)]">{selectedEnvelopeDetail.sender}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-3">
                      <dt className="text-xs text-[var(--st-text-tertiary)]">Created</dt>
                      <dd className="col-span-2 text-[var(--st-text)] tabular-nums">{new Date(selectedEnvelopeDetail.created).toLocaleString()}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-3">
                      <dt className="text-xs text-[var(--st-text-tertiary)]">Last modified</dt>
                      <dd className="col-span-2 text-[var(--st-text)] tabular-nums">{new Date(selectedEnvelopeDetail.lastModified).toLocaleString()}</dd>
                    </div>
                  </dl>
                </Card>
              </section>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-[var(--st-border)] p-4">
              <Button variant="secondary" size="sm" iconLeft={Download} onClick={() => toast.success('Document download started')}>Download</Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" iconLeft={Copy} onClick={() => toast.success('Envelope cloned')}>Clone</Button>
                <Button variant="primary" size="sm" iconLeft={Eye} onClick={() => toast.info('Opening document viewer')}>View</Button>
              </div>
            </footer>
          </aside>
        </>
      )}
    </main>
  );
}
