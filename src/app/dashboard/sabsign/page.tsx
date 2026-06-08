"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
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
  Edit2,
  Tag as TagIcon,
  Paperclip,
  Eye,
  Send,
  MoreHorizontal,
  Hash,
  User,
  Settings,
  Star,
  Zap,
  Bell,
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
  SegmentedControl,
  EmptyState,
  Alert,
  Avatar,
  AvatarGroup,
  Tag,
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

// --- Status badge mapping (one accent rule: colour only carries status meaning) ---
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
  'Completed': <CheckCircle className="w-3 h-3" aria-hidden="true" />,
  'Sent': <Send className="w-3 h-3" aria-hidden="true" />,
  'Delivered': <Mail className="w-3 h-3" aria-hidden="true" />,
  'Draft': <FileText className="w-3 h-3" aria-hidden="true" />,
  'Declined': <X className="w-3 h-3" aria-hidden="true" />,
  'Voided': <AlertCircle className="w-3 h-3" aria-hidden="true" />,
  'Action Required': <Zap className="w-3 h-3" aria-hidden="true" />,
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
  const [selectedFolder, setSelectedFolder] = useState<string>('Inbox');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedEnvelopes, setSelectedEnvelopes] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'Action Required' | 'Waiting for Others' | 'Expiring Soon'>('All');
  const [selectedEnvelopeDetail, setSelectedEnvelopeDetail] = useState<Envelope | null>(null);

  const folders = [
    { name: 'Inbox', icon: <Mail className="w-4 h-4" aria-hidden="true" />, count: envelopes.filter(e => e.folder === 'Inbox').length },
    { name: 'Action Required', icon: <Zap className="w-4 h-4 text-[var(--st-warn)]" aria-hidden="true" />, count: envelopes.filter(e => e.status === 'Action Required').length },
    { name: 'Sent', icon: <Send className="w-4 h-4" aria-hidden="true" />, count: envelopes.filter(e => e.status === 'Sent').length },
    { name: 'Drafts', icon: <FileText className="w-4 h-4" aria-hidden="true" />, count: envelopes.filter(e => e.status === 'Draft').length },
    { name: 'Deleted', icon: <Trash2 className="w-4 h-4" aria-hidden="true" />, count: 0 },
    { name: 'Contracts', icon: <FolderPlus className="w-4 h-4" aria-hidden="true" />, count: envelopes.filter(e => e.folder === 'Contracts').length },
    { name: 'HR Documents', icon: <FolderPlus className="w-4 h-4" aria-hidden="true" />, count: envelopes.filter(e => e.folder === 'HR Documents').length },
  ];

  const filteredEnvelopes = useMemo(() => {
    return envelopes.filter(env => {
      const matchesSearch = env.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            env.id.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFolder = true;
      if (selectedFolder === 'Inbox') matchesFolder = env.folder === 'Inbox' || !['Draft', 'Sent'].includes(env.status);
      else if (selectedFolder === 'Sent') matchesFolder = env.status === 'Sent' || env.status === 'Delivered';
      else if (selectedFolder === 'Drafts') matchesFolder = env.status === 'Draft';
      else if (selectedFolder === 'Action Required') matchesFolder = env.status === 'Action Required';
      else matchesFolder = env.folder === selectedFolder;

      let matchesTab = true;
      if (activeTab === 'Action Required') matchesTab = env.status === 'Action Required';
      if (activeTab === 'Waiting for Others') matchesTab = env.status === 'Sent' || env.status === 'Delivered';

      return matchesSearch && matchesFolder && matchesTab;
    });
  }, [envelopes, searchQuery, selectedFolder, activeTab]);

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

  const handleRowClick = (envelope: Envelope) => {
    setSelectedEnvelopeDetail(envelope);
  };

  const closeDetail = () => {
    setSelectedEnvelopeDetail(null);
  };

  return (
    <div className="20ui dark flex h-screen bg-[var(--st-bg)] text-[var(--st-text)] font-sans overflow-hidden">

      {/* Sidebar Navigation */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] transition-all duration-300 flex flex-col z-10`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--st-border)]">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center" aria-hidden="true">
                <Edit2 className="w-4 h-4 text-[var(--st-text-inverted)]" />
              </span>
              <span className="font-bold text-lg text-[var(--st-text)] tracking-wide">SabSign</span>
            </div>
          ) : (
            <span className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center mx-auto" aria-hidden="true">
              <Edit2 className="w-4 h-4 text-[var(--st-text-inverted)]" />
            </span>
          )}
          <IconButton
            label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            icon={isSidebarOpen ? ChevronLeft : ChevronRight}
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>

        <div className="p-4">
          <Button variant="primary" block={isSidebarOpen} iconLeft={Plus} className={!isSidebarOpen ? 'justify-center px-0' : ''}>
            {isSidebarOpen ? 'New Envelope' : null}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="space-y-1 px-2">
            {folders.map((folder, idx) => {
              const active = selectedFolder === folder.name;
              return (
                <Button
                  key={idx}
                  variant={active ? 'secondary' : 'ghost'}
                  block
                  onClick={() => { setSelectedFolder(folder.name); setCurrentPage(1); }}
                  title={!isSidebarOpen ? folder.name : undefined}
                  aria-label={!isSidebarOpen ? folder.name : undefined}
                  aria-pressed={active}
                  className={active ? 'text-[var(--st-accent)]' : 'text-[var(--st-text-secondary)]'}
                >
                  <span className={`flex w-full items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    <span className="flex items-center gap-3">
                      {folder.icon}
                      {isSidebarOpen && <span className="text-sm font-medium">{folder.name}</span>}
                    </span>
                    {isSidebarOpen && folder.count > 0 && (
                      <Badge tone={active ? 'accent' : 'neutral'}>{folder.count}</Badge>
                    )}
                  </span>
                </Button>
              );
            })}
          </div>

          {isSidebarOpen && (
            <div className="mt-8 px-5">
              <h3 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-3">Quick Filters</h3>
              <div className="space-y-1">
                <Button variant="ghost" block iconLeft={Star} className="justify-start text-[var(--st-text-secondary)]">Starred</Button>
                <Button variant="ghost" block iconLeft={Clock} className="justify-start text-[var(--st-text-secondary)]">Expiring Soon</Button>
                <Button variant="ghost" block iconLeft={CheckCircle} className="justify-start text-[var(--st-text-secondary)]">Completed Recently</Button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--st-border)]">
          <div className={`flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <Avatar name="Harsh Khandelwal" size="sm" shape="round" />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--st-text)] truncate">Harsh K.</p>
                <p className="text-xs text-[var(--st-text-tertiary)] truncate">Admin Account</p>
              </div>
            )}
            {isSidebarOpen && (
              <IconButton label="Account settings" icon={Settings} variant="ghost" size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--st-border)] bg-[var(--st-bg)] z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-[var(--st-text)]">{selectedFolder}</h1>
            <span className="h-4 w-px bg-[var(--st-border-strong)] hidden md:block" aria-hidden="true" />
            <div className="hidden md:block">
              <SegmentedControl
                aria-label="Filter envelopes"
                size="sm"
                value={activeTab}
                onChange={(v) => setActiveTab(v as typeof activeTab)}
                items={[
                  { value: 'All', label: 'All' },
                  { value: 'Action Required', label: 'Action Required' },
                  { value: 'Waiting for Others', label: 'Waiting for Others' },
                  { value: 'Expiring Soon', label: 'Expiring Soon' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Field className="w-64 md:w-80">
              <Input
                type="text"
                inputSize="sm"
                iconLeft={Search}
                placeholder="Search envelopes, signers, IDs..."
                aria-label="Search envelopes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Field>

            <IconButton label="Filter" icon={Filter} variant="outline" size="sm" />
            <IconButton label="Notifications" icon={Bell} variant="outline" size="sm" />
          </div>
        </header>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                size="sm"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleSelectAll}
                aria-label="Select all envelopes"
              />
              <span className="text-sm text-[var(--st-text-secondary)] font-medium">
                {selectedEnvelopes.size > 0 ? `${selectedEnvelopes.size} selected` : 'Select All'}
              </span>
            </div>

            {selectedEnvelopes.size > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <span className="h-4 w-px bg-[var(--st-border)]" aria-hidden="true" />
                <IconButton label="Download selected" icon={Download} variant="ghost" size="sm" onClick={() => toast.success(`${selectedEnvelopes.size} envelope(s) queued for download`)} />
                <IconButton label="Delete selected" icon={Trash2} variant="ghost" size="sm" onClick={() => toast.error('Delete is not available in this view')} />
                <IconButton label="Move to folder" icon={FolderPlus} variant="ghost" size="sm" onClick={() => toast.info('Pick a destination folder')} />
                <IconButton label="More actions" icon={MoreHorizontal} variant="ghost" size="sm" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <span>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredEnvelopes.length)}-{Math.min(currentPage * itemsPerPage, filteredEnvelopes.length)} of {filteredEnvelopes.length}</span>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Previous page"
                  icon={ChevronLeft}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                />
                <IconButton
                  label="Next page"
                  icon={ChevronRight}
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Grid / List */}
        <div className="flex-1 overflow-y-auto bg-[var(--st-bg)] p-4 relative">

          {loading ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={Clock}
                title="Loading envelopes"
                description="Fetching your latest documents."
              />
            </div>
          ) : filteredEnvelopes.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={Mail}
                title="No envelopes found"
                description="Try adjusting your filters or search query."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => { setSearchQuery(''); setSelectedFolder('Inbox'); setActiveTab('All'); }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-1 pb-20">
              {/* List Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider sticky top-0 bg-[var(--st-bg)] z-10 border-b border-[var(--st-border)] mb-2">
                <div className="col-span-4 flex items-center gap-4">
                  <span className="w-4" aria-hidden="true" />
                  <span>Subject</span>
                </div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Recipients</div>
                <div className="col-span-2">Last Modified</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {paginatedEnvelopes.map((env) => (
                <div
                  key={env.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowClick(env)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(env); } }}
                  className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center rounded-[var(--st-radius-lg)] border transition-colors cursor-pointer group ${selectedEnvelopes.has(env.id) ? 'bg-[var(--st-accent-soft)] border-[var(--st-accent)]' : 'bg-[var(--st-bg-secondary)] border-transparent hover:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]'}`}
                >
                  <div className="col-span-4 flex items-center gap-4 min-w-0">
                    <span onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <Checkbox
                        size="sm"
                        checked={selectedEnvelopes.has(env.id)}
                        onChange={() => toggleSelection(env.id)}
                        aria-label={`Select ${env.subject}`}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--st-text)] truncate">{env.subject}</span>
                        {env.isStarred && <Star className="w-3.5 h-3.5 text-[var(--st-warn)] fill-current flex-shrink-0" aria-label="Starred" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--st-text-tertiary)]">
                        <span className="truncate">{env.id}</span>
                        <span aria-hidden="true">|</span>
                        <span className="truncate">{env.folder}</span>
                        {env.tags.map(tag => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <StatusBadge status={env.status} />
                  </div>

                  <div className="col-span-3 min-w-0">
                    <AvatarGroup max={3} size="sm" shape="round" label={`${env.recipients.length} recipient${env.recipients.length === 1 ? '' : 's'}`}>
                      {env.recipients.map((rec, i) => (
                        <Avatar key={i} name={rec.name} size="sm" shape="round" />
                      ))}
                    </AvatarGroup>
                    <div className="text-xs text-[var(--st-text-tertiary)] mt-1 truncate">
                      {env.recipients.length === 1 ? env.recipients[0].name : `${env.recipients.length} recipients`}
                    </div>
                  </div>

                  <div className="col-span-2 text-sm text-[var(--st-text-secondary)]">
                    <div>{new Date(env.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div className="text-xs text-[var(--st-text-tertiary)]">{new Date(env.lastModified).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton label="Quick view" icon={Eye} variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRowClick(env); }} />
                    <IconButton label="More options" icon={MoreVertical} variant="ghost" size="sm" onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {paginatedEnvelopes.map((env) => (
                <Card
                  key={env.id}
                  variant="interactive"
                  padding="md"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowClick(env)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(env); } }}
                  className={`relative flex flex-col cursor-pointer group ${selectedEnvelopes.has(env.id) ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]' : ''}`}
                >
                  <span className="absolute top-4 right-4 z-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="sm"
                      checked={selectedEnvelopes.has(env.id)}
                      onChange={() => toggleSelection(env.id)}
                      aria-label={`Select ${env.subject}`}
                    />
                  </span>

                  <div className="flex justify-between items-start mb-4">
                    <StatusBadge status={env.status} />
                    {env.isStarred && <Star className="w-4 h-4 text-[var(--st-warn)] fill-current" aria-label="Starred" />}
                  </div>

                  <h3 className="text-base font-medium text-[var(--st-text)] mb-1 line-clamp-2">{env.subject}</h3>
                  <p className="text-xs text-[var(--st-text-tertiary)] mb-4">{env.id}</p>

                  <div className="mt-auto">
                    <div className="flex items-center justify-between py-3 border-t border-[var(--st-border)] mt-2">
                      <AvatarGroup max={3} size="sm" shape="round" label={`${env.recipients.length} recipient${env.recipients.length === 1 ? '' : 's'}`}>
                        {env.recipients.map((rec, i) => (
                          <Avatar key={i} name={rec.name} size="sm" shape="round" />
                        ))}
                      </AvatarGroup>
                      <span className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1"><Paperclip className="w-3 h-3" aria-hidden="true" /> {env.size}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--st-text-tertiary)] pt-2 border-t border-[var(--st-border)]">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden="true" /> {new Date(env.lastModified).toLocaleDateString()}</span>
                      <Badge tone="neutral">{env.folder}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detailed Flyout Panel */}
        {selectedEnvelopeDetail && (
          <div className="absolute inset-y-0 right-0 w-full md:w-[480px] bg-[var(--st-bg-secondary)] border-l border-[var(--st-border)] shadow-2xl flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--st-border)] bg-[var(--st-bg)]">
              <div className="flex items-center gap-3">
                <IconButton label="Close details" icon={X} variant="ghost" size="sm" onClick={closeDetail} />
                <h2 className="text-lg font-semibold text-[var(--st-text)]">Envelope Details</h2>
              </div>
              <div className="flex items-center gap-1">
                <IconButton label={selectedEnvelopeDetail.isStarred ? 'Unstar envelope' : 'Star envelope'} icon={Star} variant="ghost" size="sm" />
                <IconButton label="More options" icon={MoreVertical} variant="ghost" size="sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Title & Status */}
              <div>
                <div className="flex items-start justify-between mb-2 gap-4">
                  <h3 className="text-xl font-bold text-[var(--st-text)] leading-tight">{selectedEnvelopeDetail.subject}</h3>
                  <StatusBadge status={selectedEnvelopeDetail.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-[var(--st-text-secondary)] mt-3">
                  <span className="flex items-center gap-1"><Hash className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" /> {selectedEnvelopeDetail.id}</span>
                  <span className="flex items-center gap-1"><FolderPlus className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" /> {selectedEnvelopeDetail.folder}</span>
                </div>
              </div>

              {/* Action notice based on status */}
              {selectedEnvelopeDetail.status === 'Action Required' && (
                <Alert tone="warning" title="Your signature is required">
                  <p className="mb-3">Please review and sign this document to proceed.</p>
                  <Button variant="primary" size="sm" onClick={() => toast.info('Opening the signing flow')}>
                    Sign Now
                  </Button>
                </Alert>
              )}

              {/* Recipients Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" aria-hidden="true" /> Recipients
                </h3>
                <div className="space-y-4">
                  {selectedEnvelopeDetail.recipients.map((rec, i) => (
                    <div key={i} className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        {rec.status === 'Signed' ? (
                          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--st-status-ok)] text-[var(--st-text-inverted)]" aria-hidden="true">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        ) : (
                          <Avatar name={rec.name} size="md" shape="round" />
                        )}
                        {i < selectedEnvelopeDetail.recipients.length - 1 && (
                          <span className="w-px h-10 bg-[var(--st-border)] my-1" aria-hidden="true" />
                        )}
                      </div>
                      <Card variant="outlined" padding="sm" className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[var(--st-text)]">{rec.name}</p>
                          <Badge tone={RECIPIENT_TONE[rec.status]}>{rec.status}</Badge>
                        </div>
                        <p className="text-xs text-[var(--st-text-tertiary)] mt-1">{rec.email}</p>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details List */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" aria-hidden="true" /> Details
                </h3>
                <Card variant="outlined" padding="none">
                  <CardBody className="p-0">
                    <div className="grid grid-cols-3 gap-4 p-3 border-b border-[var(--st-border)]">
                      <span className="text-xs text-[var(--st-text-tertiary)]">Sent By</span>
                      <span className="col-span-2 text-sm text-[var(--st-text)]">{selectedEnvelopeDetail.sender}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-3 border-b border-[var(--st-border)]">
                      <span className="text-xs text-[var(--st-text-tertiary)]">Created</span>
                      <span className="col-span-2 text-sm text-[var(--st-text)]">{new Date(selectedEnvelopeDetail.created).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-3 border-b border-[var(--st-border)]">
                      <span className="text-xs text-[var(--st-text-tertiary)]">Last Modified</span>
                      <span className="col-span-2 text-sm text-[var(--st-text)]">{new Date(selectedEnvelopeDetail.lastModified).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-3 border-b border-[var(--st-border)]">
                      <span className="text-xs text-[var(--st-text-tertiary)]">File Size</span>
                      <span className="col-span-2 text-sm text-[var(--st-text)]">{selectedEnvelopeDetail.size}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 p-3">
                      <span className="text-xs text-[var(--st-text-tertiary)]">Tags</span>
                      <div className="col-span-2 flex flex-wrap gap-2 items-center">
                        {selectedEnvelopeDetail.tags.length > 0 ? selectedEnvelopeDetail.tags.map(tag => (
                          <Tag key={tag}>{tag}</Tag>
                        )) : <span className="text-sm text-[var(--st-text-tertiary)] italic">No tags</span>}
                        <Button variant="ghost" size="sm" iconLeft={Plus}>Add</Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg)] flex items-center justify-between gap-3">
              <Button variant="secondary" iconLeft={Download} onClick={() => toast.success('Document download started')}>Download</Button>
              <div className="flex gap-3">
                <Button variant="secondary" iconLeft={Copy} onClick={() => toast.success('Envelope cloned')}>Clone</Button>
                <Button variant="primary" iconLeft={Eye} onClick={() => toast.info('Opening document viewer')}>View Document</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop for detail view on mobile/tablet (decorative dim; the panel's Close button dismisses) */}
      {selectedEnvelopeDetail && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeDetail}
        />
      )}
    </div>
  );
}
