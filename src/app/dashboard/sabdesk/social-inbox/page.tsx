"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Filter, CheckCircle2, AlertCircle, MessageCircle,
  MoreVertical, Clock, CheckSquare, Archive, Tag,
  UserPlus, ThumbsUp, Repeat, ExternalLink,
  CornerUpLeft, Send, Paperclip, Image as ImageIcon, Smile,
  Zap, Sparkles, Plus, MoreHorizontal,
  AlertOctagon, LayoutGrid, SlidersHorizontal,
  Bell, ChevronRight, RefreshCw, ChevronLeft,
  User, Building2, MapPin, Globe, FileText, Heart,
  Share2, BarChart2, BadgeCheck, MessageSquare,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  Badge,
  Field,
  Input,
  Textarea,
  EmptyState,
  StatCard,
  PageHeader,
  PageActions,
  Separator,
  Kbd,
  Avatar,
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';

import { getSocialInboxMessages } from '@/app/actions/sabdesk-assist.actions';

// ==========================================
// Brand / platform glyphs (decorative SVG logos, not control primitives)
// ==========================================

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.04c-5.5 0-10 4.48-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10.05 10.05 0 0 0 8.44-9.9c0-5.54-4.5-10.02-10-10.02Z" />
  </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.36c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.83v5.45h-3.56v-10.7h3.41v1.46h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v5.64zM5.34 8.29c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm1.78 12.16H3.56v-10.7h3.56v10.7zM22.22 0H1.78C.8 0 0 .78 0 1.74v20.52C0 23.22.8 24 1.78 24h20.44c.98 0 1.78-.78 1.78-1.74V1.74C24 .78 23.2 0 22.22 0z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.67 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.25-.15-4.77-1.69-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.67-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 2.69.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.36-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm5.22-10.53a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z" />
  </svg>
);

const InboxIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const MinusCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const PlatformIcon = ({ platform, className = "" }: { platform: string; className?: string }) => {
  switch (platform) {
    case 'twitter': return <XIcon className={`text-[var(--st-text)] ${className}`} />;
    case 'facebook': return <FacebookIcon className={`text-[#1877f2] ${className}`} />;
    case 'linkedin': return <LinkedInIcon className={`text-[#0a66c2] ${className}`} />;
    case 'instagram': return <InstagramIcon className={`text-[#e1306c] ${className}`} />;
    default: return <MessageSquare className={`text-[var(--st-text-tertiary)] ${className}`} aria-hidden="true" />;
  }
};

// ==========================================
// Types & Interfaces
// ==========================================

type Platform = 'twitter' | 'facebook' | 'linkedin' | 'instagram';
type Sentiment = 'positive' | 'neutral' | 'negative';
type Status = 'open' | 'pending' | 'resolved' | 'spam';
type Priority = 'high' | 'medium' | 'low';

interface Author {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  followers: number;
  isVerified: boolean;
  vipStatus?: boolean;
  location?: string;
  company?: string;
  crmId?: string;
  sentiment_score?: number;
}

interface Metric {
  likes: number;
  shares: number;
  comments: number;
  views?: number;
}

interface SocialMessage {
  id: string;
  platform: Platform;
  author: Author;
  content: string;
  media?: string[];
  timestamp: string;
  sentiment: Sentiment;
  status: Status;
  priority: Priority;
  tags: string[];
  metrics: Metric;
  isRead: boolean;
  assignedTo?: string;
  threadId?: string;
}

// ==========================================
// Status / Sentiment / Priority badges (20ui Badge)
// ==========================================

const SENTIMENT_BADGE: Record<Sentiment, { tone: 'success' | 'neutral' | 'danger'; icon: typeof Smile }> = {
  positive: { tone: 'success', icon: Smile },
  neutral: { tone: 'neutral', icon: MinusCircleIcon },
  negative: { tone: 'danger', icon: AlertCircle },
};

const SentimentBadge = ({ sentiment }: { sentiment: Sentiment }) => {
  const cfg = SENTIMENT_BADGE[sentiment];
  const Icon = cfg.icon;
  return (
    <Badge tone={cfg.tone} kind="soft" className="capitalize">
      <Icon className="w-3.5 h-3.5" />
      {sentiment}
    </Badge>
  );
};

const STATUS_BADGE: Record<Status, { tone: 'warning' | 'info' | 'success' | 'neutral'; icon: typeof Clock }> = {
  open: { tone: 'warning', icon: AlertOctagon },
  pending: { tone: 'info', icon: Clock },
  resolved: { tone: 'success', icon: CheckCircle2 },
  spam: { tone: 'neutral', icon: Archive },
};

const StatusBadge = ({ status }: { status: Status }) => {
  const cfg = STATUS_BADGE[status];
  const Icon = cfg.icon;
  return (
    <Badge tone={cfg.tone} kind="soft" className="capitalize">
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
};

const PRIORITY_BADGE: Record<Priority, { tone: 'danger' | 'warning' | 'info'; label: string }> = {
  high: { tone: 'danger', label: 'P1' },
  medium: { tone: 'warning', label: 'P2' },
  low: { tone: 'info', label: 'P3' },
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const cfg = PRIORITY_BADGE[priority];
  return <Badge tone={cfg.tone} kind="soft">{cfg.label}</Badge>;
};

// ==========================================
// Main Page Component
// ==========================================

export default function SocialInbox() {
  const { toast } = useToast();

  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await getSocialInboxMessages();
        if (res.success && res.data) {
          setMessages(res.data as unknown as SocialMessage[]);
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not load the social inbox.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('open');
  const [sentimentFilter] = useState<Sentiment | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'me' | 'unassigned'>('all');

  // UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Derived State
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (platformFilter !== 'all' && msg.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && msg.status !== statusFilter) return false;
      if (sentimentFilter !== 'all' && msg.sentiment !== sentimentFilter) return false;
      if (assigneeFilter === 'me' && msg.assignedTo !== 'currentUser') return false;
      if (assigneeFilter === 'unassigned' && msg.assignedTo) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          msg.content.toLowerCase().includes(query) ||
          msg.author.name.toLowerCase().includes(query) ||
          msg.author.handle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [messages, platformFilter, statusFilter, sentimentFilter, assigneeFilter, searchQuery]);

  const activeMessage = useMemo(() =>
    messages.find(m => m.id === activeMessageId),
  [messages, activeMessageId]);

  // Handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    }
  };

  const markAsRead = (ids: Set<string>) => {
    setMessages(prev => prev.map(m => ids.has(m.id) ? { ...m, isRead: true } : m));
    if (ids.size > 1) setSelectedIds(new Set());
  };

  const changeStatus = (ids: Set<string>, status: Status) => {
    setMessages(prev => prev.map(m => ids.has(m.id) ? { ...m, status } : m));
    if (ids.size > 1) setSelectedIds(new Set());
  };

  const handleSendReply = () => {
    if (!replyContent.trim() || !replyingTo) return;
    setMessages(prev => prev.map(m => m.id === replyingTo ? { ...m, status: 'resolved', isRead: true } : m));
    toast.success('Reply sent and conversation resolved.');
    setReplyContent("");
    setReplyingTo(null);
  };

  const generateAiReply = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      setReplyContent("Thank you for reaching out! We've noted your feedback and our team is looking into this immediately. Please let us know if you have any other questions via DM.");
      setIsAiGenerating(false);
      toast.info('AI drafted a suggested reply.');
    }, 1500);
  };

  // Format Date
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const statusViews: { id: Status; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { id: 'open', label: 'Open', icon: InboxIcon, count: messages.filter(m => m.status === 'open').length },
    { id: 'pending', label: 'Pending', icon: Clock, count: messages.filter(m => m.status === 'pending').length },
    { id: 'resolved', label: 'Resolved', icon: CheckCircle2, count: messages.filter(m => m.status === 'resolved').length },
    { id: 'spam', label: 'Spam', icon: AlertOctagon, count: messages.filter(m => m.status === 'spam').length },
  ];

  const channels: { id: Platform; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'twitter', label: 'X (Twitter)', icon: XIcon },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon },
    { id: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon },
    { id: 'instagram', label: 'Instagram', icon: InstagramIcon },
  ];

  const assignments: { id: 'all' | 'me' | 'unassigned'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'all', label: 'All Messages', icon: UsersIcon },
    { id: 'me', label: 'Assigned to me', icon: User },
    { id: 'unassigned', label: 'Unassigned', icon: HelpCircleIcon },
  ];

  const navItemClass = (active: boolean) =>
    `!justify-start w-full ${active ? 'text-[var(--st-accent)] bg-[var(--st-accent-soft)]' : 'text-[var(--st-text-secondary)]'}`;

  return (
    <div className="ui20 dark flex h-screen bg-[var(--st-bg)] text-[var(--st-text)] overflow-hidden">

      {/* ========================================== */}
      {/* LEFT SIDEBAR - FILTERS */}
      {/* ========================================== */}
      <aside className={`flex flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--st-border)]">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center" aria-hidden="true">
                <MessageSquare className="w-4 h-4 text-[var(--st-text-inverted)]" />
              </span>
              Inbox
            </div>
          )}
          <IconButton
            label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={isSidebarCollapsed ? ChevronRight : ChevronLeft}
            variant="ghost"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {!isSidebarCollapsed ? (
            <div className="px-3 space-y-6">

              {/* Status Filters */}
              <div>
                <h2 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 px-2">Views</h2>
                <div className="space-y-0.5">
                  {statusViews.map(item => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="sm"
                        block
                        onClick={() => setStatusFilter(item.id)}
                        className={navItemClass(statusFilter === item.id)}
                      >
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <Badge tone="neutral" kind="soft">{item.count}</Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Platform Filters */}
              <div>
                <h2 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 px-2">Channels</h2>
                <div className="space-y-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    iconLeft={LayoutGrid}
                    onClick={() => setPlatformFilter('all')}
                    className={navItemClass(platformFilter === 'all')}
                  >
                    All Channels
                  </Button>
                  {channels.map(item => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="sm"
                        block
                        onClick={() => setPlatformFilter(item.id)}
                        className={navItemClass(platformFilter === item.id)}
                      >
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment */}
              <div>
                <h2 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 px-2">Assignment</h2>
                <div className="space-y-0.5">
                  {assignments.map(item => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        size="sm"
                        block
                        onClick={() => setAssigneeFilter(item.id)}
                        className={navItemClass(assigneeFilter === item.id)}
                      >
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h2 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 px-2">Tags</h2>
                <div className="flex flex-wrap gap-2 px-2">
                  {['bug', 'urgent', 'feature-request', 'billing', 'feedback'].map(tag => (
                    <Badge key={tag} tone="neutral" kind="outline">#{tag}</Badge>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pt-2">
              <IconButton label="Open" icon={InboxIcon} variant="ghost" />
              <IconButton label="X (Twitter)" icon={XIcon} variant="ghost" onClick={() => setPlatformFilter('twitter')} />
              <IconButton label="LinkedIn" icon={LinkedInIcon} variant="ghost" onClick={() => setPlatformFilter('linkedin')} />
              <IconButton label="Facebook" icon={FacebookIcon} variant="ghost" onClick={() => setPlatformFilter('facebook')} />
            </div>
          )}
        </div>
      </aside>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--st-bg)]">

        {/* Top Header / Search / Bulk Actions */}
        <PageHeader bordered compact className="h-16 flex-row items-center gap-4 px-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-96 max-w-full">
              <Field className="!gap-0" label={<span className="sr-only">Search inbox</span>}>
                <Input
                  type="text"
                  placeholder="Search messages, users, or keywords"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  iconLeft={Search}
                  suffix={<Kbd>⌘K</Kbd>}
                />
              </Field>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" iconLeft={Filter}>More Filters</Button>
              <Button variant="secondary" size="sm" iconLeft={SlidersHorizontal}>Sort: Newest</Button>
            </div>
          </div>

          <PageActions className="items-center gap-3">
            <span className="relative inline-flex">
              <IconButton label="Notifications" icon={Bell} variant="ghost" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--st-danger)]" aria-hidden="true" />
            </span>
            <Avatar name="You" src="https://i.pravatar.cc/150?img=11" size="sm" shape="round" />
          </PageActions>
        </PageHeader>

        {/* Bulk Action Bar (Appears when items selected) */}
        {selectedIds.size > 0 && (
          <div className="h-14 flex items-center justify-between px-6 bg-[var(--st-accent-soft)] border-b border-[var(--st-border)]">
            <div className="flex items-center gap-4 flex-wrap">
              <Badge tone="accent" kind="soft">{selectedIds.size} selected</Badge>
              <Separator orientation="vertical" className="h-4" />
              <Button variant="ghost" size="sm" iconLeft={CheckCircle2} onClick={() => markAsRead(selectedIds)}>Mark Read</Button>
              <Button variant="ghost" size="sm" iconLeft={CheckSquare} onClick={() => changeStatus(selectedIds, 'resolved')}>Resolve</Button>
              <Button variant="ghost" size="sm" iconLeft={AlertOctagon} onClick={() => changeStatus(selectedIds, 'spam')}>Mark Spam</Button>
              <Button variant="ghost" size="sm" iconLeft={UserPlus}>Assign</Button>
              <Button variant="ghost" size="sm" iconLeft={Tag}>Add Tag</Button>
            </div>
            <IconButton label="Clear selection" icon={Plus} variant="ghost" onClick={() => setSelectedIds(new Set())} className="rotate-45" />
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Feed List */}
          <div className={`flex flex-col border-r border-[var(--st-border)] transition-all duration-300 ${activeMessageId ? 'w-[45%]' : 'w-full'}`}>

            {/* List Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--st-border)] bg-[var(--st-bg)]">
              <div className="flex items-center gap-3">
                <IconButton
                  label={selectedIds.size === filteredMessages.length && filteredMessages.length > 0 ? 'Deselect all' : 'Select all'}
                  icon={CheckSquare}
                  variant="ghost"
                  onClick={toggleAll}
                />
                <span className="text-sm font-medium text-[var(--st-text-secondary)]">
                  Showing {filteredMessages.length} conversations
                </span>
              </div>
              <IconButton label="Refresh" icon={RefreshCw} variant="ghost" />
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--st-text-secondary)]">
                  <Spinner size="lg" label="Loading conversations" />
                  <p className="text-sm">Loading conversations.</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No messages match your filters"
                  description="Try a different view, channel, or clear your search to see more conversations."
                />
              ) : (
                filteredMessages.map(msg => {
                  const isSelected = selectedIds.has(msg.id);
                  const isActive = activeMessageId === msg.id;

                  return (
                    <Card
                      key={msg.id}
                      variant="interactive"
                      padding="sm"
                      onClick={() => {
                        if (!msg.isRead) markAsRead(new Set([msg.id]));
                        setActiveMessageId(msg.id);
                      }}
                      className={`group flex gap-3 relative overflow-hidden cursor-pointer ${
                        isActive
                          ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                          : isSelected
                            ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                            : ''
                      }`}
                    >
                      {/* Unread Indicator */}
                      {!msg.isRead && (
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--st-accent)]" aria-hidden="true" />
                      )}

                      {/* Checkbox & Avatar */}
                      <div className="flex flex-col items-center gap-2 pt-1">
                        <IconButton
                          label={isSelected ? 'Deselect conversation' : 'Select conversation'}
                          icon={CheckSquare}
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); toggleSelection(msg.id); }}
                          className={isSelected ? 'text-[var(--st-accent)]' : ''}
                        />
                        <div className="relative">
                          <Avatar name={msg.author.name} src={msg.author.avatar} size="md" shape="round" />
                          <span className="absolute -bottom-1 -right-1 p-0.5 bg-[var(--st-bg)] rounded-full" aria-hidden="true">
                            <PlatformIcon platform={msg.platform} className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-medium text-[var(--st-text)] truncate">{msg.author.name}</span>
                            <span className="text-sm text-[var(--st-text-tertiary)] truncate">{msg.author.handle}</span>
                            {msg.author.vipStatus && (
                              <Badge tone="warning" kind="soft">
                                <Sparkles className="w-3 h-3" /> VIP
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-[var(--st-text-tertiary)] whitespace-nowrap flex-shrink-0">
                            {timeAgo(msg.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <StatusBadge status={msg.status} />
                          <SentimentBadge sentiment={msg.sentiment} />
                          {msg.priority !== 'low' && <PriorityBadge priority={msg.priority} />}
                        </div>

                        <p className={`text-sm line-clamp-2 ${msg.isRead ? 'text-[var(--st-text-secondary)]' : 'text-[var(--st-text)] font-medium'}`}>
                          {msg.content}
                        </p>

                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-3 text-[var(--st-text-tertiary)]">
                            <span className="flex items-center gap-1 text-xs"><ThumbsUp className="w-3 h-3" aria-hidden="true" /> {msg.metrics.likes}</span>
                            <span className="flex items-center gap-1 text-xs"><Repeat className="w-3 h-3" aria-hidden="true" /> {msg.metrics.shares}</span>
                            <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-3 h-3" aria-hidden="true" /> {msg.metrics.comments}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {msg.tags.slice(0, 2).map(tag => (
                              <Badge key={tag} tone="neutral" kind="outline">#{tag}</Badge>
                            ))}
                            {msg.tags.length > 2 && <span className="text-[10px] text-[var(--st-text-tertiary)]">+{msg.tags.length - 2}</span>}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Detailed View / Editor (Right Panel) */}
          {activeMessageId && activeMessage && (
            <div className="w-[55%] flex flex-col h-full bg-[var(--st-bg-secondary)] relative">

              {/* Detail Header */}
              <div className="h-14 flex items-center justify-between px-6 border-b border-[var(--st-border)] shrink-0 bg-[var(--st-bg)]">
                <div className="flex items-center gap-3">
                  <IconButton label="Close conversation" icon={ChevronLeft} variant="ghost" onClick={() => setActiveMessageId(null)} />
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={activeMessage.platform} className="w-5 h-5" />
                    <span className="font-medium capitalize text-[var(--st-text)]">{activeMessage.platform} Conversation</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label="Copy link" icon={ExternalLink} variant="ghost" />
                  <IconButton label="More actions" icon={MoreVertical} variant="ghost" />
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto flex">

                {/* Left Side: Conversation Thread */}
                <div className="flex-1 p-6 flex flex-col gap-6">

                  {/* Original Message Large Card */}
                  <Card variant="elevated" padding="lg">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={activeMessage.author.name} src={activeMessage.author.avatar} size="lg" shape="round" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-lg text-[var(--st-text)]">{activeMessage.author.name}</h2>
                            {activeMessage.author.isVerified && <BadgeCheck className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                            <span>{activeMessage.author.handle}</span>
                            <span aria-hidden="true">.</span>
                            <span>{formatTime(activeMessage.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={activeMessage.status} />
                        <SentimentBadge sentiment={activeMessage.sentiment} />
                      </div>
                    </div>

                    <div className="text-[var(--st-text)] text-lg leading-relaxed mb-6 whitespace-pre-wrap">
                      {activeMessage.content}
                    </div>

                    <Separator className="mb-4" />

                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4 text-[var(--st-text-secondary)]">
                        <span className="flex items-center gap-1.5 text-sm"><MessageCircle className="w-4 h-4" aria-hidden="true" /> {activeMessage.metrics.comments}</span>
                        <span className="flex items-center gap-1.5 text-sm"><Repeat className="w-4 h-4" aria-hidden="true" /> {activeMessage.metrics.shares}</span>
                        <span className="flex items-center gap-1.5 text-sm"><Heart className="w-4 h-4" aria-hidden="true" /> {activeMessage.metrics.likes}</span>
                        <span className="flex items-center gap-1.5 text-sm"><BarChart2 className="w-4 h-4" aria-hidden="true" /> {activeMessage.metrics.views || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" iconLeft={Share2}>Share</Button>
                        <Button
                          variant="primary"
                          size="sm"
                          iconLeft={CornerUpLeft}
                          onClick={() => {
                            setReplyingTo(activeMessage.id);
                            setTimeout(() => document.getElementById('reply-textarea')?.focus(), 100);
                          }}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Inline Reply Editor */}
                  {replyingTo === activeMessage.id && (
                    <Card variant="elevated" padding="none" className="border-[var(--st-accent)] overflow-hidden">
                      <div className="p-3 pb-0">
                        <Field className="!gap-0" label={<span className="sr-only">Reply message</span>}>
                          <Textarea
                            id="reply-textarea"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={`Reply to ${activeMessage.author.name} on ${activeMessage.platform}`}
                            rows={5}
                            className="min-h-[120px]"
                          />
                        </Field>
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-3 p-3 border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                        <div className="flex items-center gap-1">
                          <IconButton label="Attach file" icon={Paperclip} variant="ghost" />
                          <IconButton label="Add image" icon={ImageIcon} variant="ghost" />
                          <IconButton label="Add emoji" icon={Smile} variant="ghost" />
                          <Separator orientation="vertical" className="h-5 mx-1" />
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={isAiGenerating ? undefined : Zap}
                            loading={isAiGenerating}
                            onClick={generateAiReply}
                          >
                            {isAiGenerating ? 'Generating' : 'AI Suggest'}
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>Cancel</Button>
                          <Button
                            variant="primary"
                            size="sm"
                            iconRight={Send}
                            disabled={!replyContent.trim()}
                            onClick={handleSendReply}
                          >
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Internal Notes / Thread placeholder */}
                  {!replyingTo && (
                    <Card variant="ghost" padding="md" className="flex items-center gap-4 border border-dashed border-[var(--st-border)]">
                      <span className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center" aria-hidden="true">
                        <FileText className="w-4 h-4 text-[var(--st-text-tertiary)]" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-[var(--st-text-secondary)]">No internal notes for this conversation yet.</p>
                      </div>
                      <Button variant="ghost" size="sm" iconLeft={Plus}>Add Note</Button>
                    </Card>
                  )}

                </div>

                {/* Right Side: User Context Sidebar */}
                <div className="w-72 border-l border-[var(--st-border)] bg-[var(--st-bg)] p-5 overflow-y-auto hidden xl:block">

                  <div className="flex flex-col items-center text-center pb-6 border-b border-[var(--st-border)]">
                    <Avatar name={activeMessage.author.name} src={activeMessage.author.avatar} size="lg" shape="round" className="mb-3" />
                    <h3 className="font-semibold text-lg text-[var(--st-text)]">{activeMessage.author.name}</h3>
                    <p className="text-[var(--st-text-tertiary)] text-sm mb-3">{activeMessage.author.handle}</p>

                    <div className="flex items-center gap-2 w-full">
                      <Button variant="secondary" size="sm" block iconLeft={User}>View CRM</Button>
                      <IconButton label="More contact actions" icon={MoreHorizontal} variant="secondary" />
                    </div>
                  </div>

                  <div className="py-5 border-b border-[var(--st-border)] space-y-4">
                    <h4 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2">About</h4>

                    <div className="flex items-center gap-3 text-sm text-[var(--st-text)]">
                      <Building2 className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      <span>{activeMessage.author.company || 'Unknown Company'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[var(--st-text)]">
                      <MapPin className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      <span>{activeMessage.author.location || 'Unknown Location'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[var(--st-text)]">
                      <Globe className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      <span className="text-[var(--st-accent)]">Website URL</span>
                    </div>
                  </div>

                  <div className="py-5 border-b border-[var(--st-border)]">
                    <h4 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-4">Influence Metrics</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard label="Followers" value={`${(activeMessage.author.followers / 1000).toFixed(1)}k`} />
                      <StatCard
                        label="Health Score"
                        value={activeMessage.author.sentiment_score ?? 0}
                        delta={{ value: '+4 pts', tone: 'up' }}
                      />
                    </div>
                  </div>

                  <div className="py-5">
                    <h4 className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-4">Past Interactions</h4>
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 relative">
                          <span className="w-px h-full bg-[var(--st-border)] absolute left-[15px] top-6" aria-hidden="true" />
                          <span className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] border border-[var(--st-border)] flex items-center justify-center shrink-0 relative z-10" aria-hidden="true">
                            <MessageSquare className="w-3.5 h-3.5 text-[var(--st-text-secondary)]" />
                          </span>
                          <div>
                            <div className="text-sm font-medium text-[var(--st-text)]">Ticket closed</div>
                            <div className="text-xs text-[var(--st-text-tertiary)] mt-0.5">{i} week{i > 1 ? 's' : ''} ago, Resolved by Agent</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
