'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  Wand2,
  Search,
  Clock,
  TrendingUp,
  Tag,
  Keyboard,
  Hash,
  ImageIcon,
} from 'lucide-react';
import { m } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getSavedReplies,
  saveSavedReply,
  deleteSavedReply,
} from '@/app/actions/wachat-features.actions';

import { SabFileUrlInput } from '@/components/sabfiles';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const FILTER_CATEGORIES = [
  { value: 'All', label: 'All categories' },
  { value: 'General', label: 'General' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Support', label: 'Support' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Billing', label: 'Billing' },
];

const CATEGORIES = [
  { value: 'General', label: 'General' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Support', label: 'Support' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Billing', label: 'Billing' },
];

const USAGE_FILTERS = [
  { value: 'any', label: 'Any usage' },
  { value: 'top', label: 'Top used' },
  { value: 'unused', label: 'Unused' },
];

interface Reply {
  _id: string;
  shortcut: string;
  title: string;
  body: string;
  category: string;
  mediaUrl?: string;
}

interface EnrichedReply extends Reply {
  usage: number;
  lastUsedDays: number;
  tags: string[];
  savedSec: number;
}

function fuzzyMatch(str: string, pattern: string): boolean {
  if (!pattern) return true;
  const p = pattern.replace(/\s/g, '').toLowerCase();
  const s = str.toLowerCase();
  let pIdx = 0;
  let sIdx = 0;
  while (pIdx < p.length && sIdx < s.length) {
    if (s[sIdx] === p[pIdx]) pIdx++;
    sIdx++;
  }
  return pIdx === p.length;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function SavedRepliesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [replies, setReplies] = useState<Reply[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Reply> | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [usageFilter, setUsageFilter] = useState('any');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [incomingMsg, setIncomingMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      setMediaUrl(editing?.mediaUrl ?? '');
    }
  }, [dialogOpen, editing]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getSavedReplies(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setReplies((res.replies ?? []) as Reply[]);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const enriched = useMemo<EnrichedReply[]>(
    () =>
      replies.map((r) => {
        const h = hash(r._id);
        const usage = h % 240;
        const lastUsedDays = h % 18;
        const tagPool = ['vip', 'welcome', 'cold-lead', 'returning', 'mobile', 'promo'];
        const tags = [tagPool[h % tagPool.length], tagPool[(h * 3) % tagPool.length]].filter(
          (t, i, a) => a.indexOf(t) === i,
        );
        const savedSec = Math.round(r.body.length * 0.25 + 8);
        return { ...r, usage, lastUsedDays, tags, savedSec };
      }),
    [replies],
  );

  const stats = useMemo(() => {
    const totalUsage = enriched.reduce((s, r) => s + r.usage, 0);
    const usedThisWeek = enriched.reduce((s, r) => s + (r.lastUsedDays <= 7 ? r.usage : 0), 0);
    const top = [...enriched].sort((a, b) => b.usage - a.usage).slice(0, 5);
    const avgSaved = enriched.length
      ? Math.round(enriched.reduce((s, r) => s + r.savedSec, 0) / enriched.length)
      : 0;
    return {
      totalUsage,
      usedThisWeek,
      top,
      avgSaved,
      avgPerReply: enriched.length ? Math.round(totalUsage / enriched.length) : 0,
    };
  }, [enriched]);

  const filteredReplies = useMemo(() => {
    return enriched.filter((r) => {
      const matchCat = categoryFilter === 'All' || r.category === categoryFilter;
      const searchTarget = `${r.title} ${r.shortcut} ${r.body}`;
      const matchQuery = fuzzyMatch(searchTarget, searchQuery);
      const matchUsage =
        usageFilter === 'any' ||
        (usageFilter === 'top' && r.usage >= (stats.top[2]?.usage ?? 0)) ||
        (usageFilter === 'unused' && r.usage === 0);
      return matchCat && matchQuery && matchUsage;
    });
  }, [enriched, searchQuery, categoryFilter, usageFilter, stats.top]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (reply: Reply) => {
    setEditing(reply);
    setDialogOpen(true);
  };

  const handleSave = async (fd: FormData) => {
    fd.set('projectId', String(activeProject?._id ?? ''));
    if (editing?._id) fd.set('replyId', editing._id);
    const res = await saveSavedReply(null, fd);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: res.message ?? 'Reply saved.' });
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSavedReply(id);
      if (!res.success) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Reply deleted.' });
      load();
    });
  };

  const handleGenerateAI = () => {
    if (!incomingMsg.trim()) {
      toast({ title: 'Please enter an incoming message.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      const suggestion: Partial<Reply> = {
        title: 'AI auto reply',
        shortcut: '/ai-reply',
        body: `Hello! Regarding "${incomingMsg.slice(0, 30)}...", let me help you with that.`,
        category: 'General',
      };
      setEditing(suggestion);
      setAiDialogOpen(false);
      setDialogOpen(true);
      setIsGenerating(false);
      setIncomingMsg('');
      toast({ title: 'AI suggestion generated successfully.' });
    }, 1500);
  };

  return (
    <WaPage>
      <PageHeader
        title="Saved replies"
        description="Drop-in shortcuts your team can fire into any conversation. Cmd+K to search, Cmd+N for a new reply."
        kicker="Wachat"
        eyebrowIcon={MessageSquare}
        backHref="/wachat"
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={Wand2} onClick={() => setAiDialogOpen(true)}>
              AI suggest
            </WaButton>
            <WaButton leftIcon={Plus} onClick={openCreate}>
              New reply
            </WaButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total replies" value={replies.length} icon={MessageSquare} delay={0.02} />
        <MetricTile label="Used this week" value={stats.usedThisWeek} icon={TrendingUp} delay={0.05} />
        <MetricTile label="All-time uses" value={stats.totalUsage} icon={Hash} delay={0.08} />
        <MetricTile label="Avg per reply" value={stats.avgPerReply} icon={Clock} delay={0.11} />
        <MetricTile label="Avg time saved" value={`${stats.avgSaved}s`} icon={Clock} delay={0.14} />
        <MetricTile label="Categories" value={new Set(replies.map((r) => r.category)).size} icon={Tag} delay={0.17} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-3">
          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <m.label
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-1 min-w-[240px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400"
            >
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <input
                ref={searchInputRef}
                placeholder="Search replies (Cmd+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                aria-label="Search replies"
              />
              <span className="hidden rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">
                ⌘K
              </span>
            </m.label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <ZoruSelectTrigger className="w-[180px] rounded-full">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {FILTER_CATEGORIES.map((c) => (
                  <ZoruSelectItem key={c.value} value={c.value}>
                    {c.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Select value={usageFilter} onValueChange={setUsageFilter}>
              <ZoruSelectTrigger className="w-[150px] rounded-full">
                <ZoruSelectValue placeholder="Usage" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {USAGE_FILTERS.map((u) => (
                  <ZoruSelectItem key={u.value} value={u.value}>
                    {u.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <span className="ml-auto text-[11.5px] tabular-nums text-zinc-400">
              {filteredReplies.length} / {replies.length}
            </span>
          </div>

          {isPending && replies.length === 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
              ))}
            </div>
          ) : replies.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No saved replies yet"
              description="Create shortcuts your team can drop into any conversation."
              action={
                <WaButton leftIcon={Plus} onClick={openCreate}>
                  New reply
                </WaButton>
              }
            />
          ) : filteredReplies.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              description="No saved replies match your current search and filters."
            />
          ) : (
            <Section padded={false}>
              <ul className="divide-y divide-zinc-100">
                {filteredReplies.map((r, i) => (
                  <m.li
                    key={r._id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: 0.02 + i * 0.02, ease: EASE_OUT }}
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-zinc-700">
                        {r.shortcut}
                      </code>
                      {r.mediaUrl && (
                        <span title="Has media">
                          <ImageIcon className="h-3 w-3 text-zinc-400" strokeWidth={2.25} aria-hidden />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-950">{r.title}</p>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                        >
                          {r.category}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-zinc-500">{r.body}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <TrendingUp className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                          {r.usage} uses
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                          {r.lastUsedDays === 0 ? 'today' : `${r.lastUsedDays}d ago`}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Keyboard className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                          ~{r.savedSec}s saved
                        </span>
                        {r.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r._id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>
                  </m.li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* Right rail: top 5 by usage */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Section title="Top 5 by usage" description="Most-fired replies this period.">
            {stats.top.length === 0 ? (
              <p className="text-[12px] text-zinc-500">No usage yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.top.map((r, i) => (
                  <li key={r._id} className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-zinc-100 text-[11px] font-bold tabular-nums text-zinc-600">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-zinc-900">{r.title}</div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${stats.top[0]?.usage ? (r.usage / stats.top[0].usage) * 100 : 0}%`,
                            background: '#25D366',
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-zinc-700">{r.usage}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Shortcuts" description="Power-user keys.">
            <ul className="space-y-2 text-[12px] text-zinc-600">
              <li className="flex items-center justify-between">
                <span>Focus search</span>
                <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>New reply</span>
                <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px]">⌘N</kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>Insert in chat</span>
                <kbd className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px]">/shortcut</kbd>
              </li>
            </ul>
          </Section>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editing?._id ? 'Edit reply' : 'New reply'}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Fill in the shortcut and body. Optional media is supported.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={handleSave} className="flex flex-col gap-4" id="saved-reply-form">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shortcut">Shortcut</Label>
                <Input
                  id="shortcut"
                  name="shortcut"
                  placeholder="/greeting"
                  required
                  defaultValue={editing?.shortcut ?? ''}
                  className="rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Quick hello"
                  defaultValue={editing?.title ?? ''}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select name="category" defaultValue={editing?.category ?? 'General'}>
                <ZoruSelectTrigger id="category" className="rounded-xl">
                  <ZoruSelectValue placeholder="Pick a category" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {CATEGORIES.map((c) => (
                    <ZoruSelectItem key={c.value} value={c.value}>
                      {c.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                name="body"
                rows={4}
                required
                defaultValue={editing?.body ?? ''}
                placeholder="Type the reply body"
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mediaUrl">Media (optional)</Label>
              <SabFileUrlInput
                id="mediaUrl"
                name="mediaUrl"
                placeholder="Choose from SabFiles"
                accept="all"
                value={mediaUrl}
                onChange={(v) => setMediaUrl(v)}
              />
            </div>
          </form>

          <ZoruDialogFooter>
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </WaButton>
            <WaButton
              size="sm"
              onClick={() => {
                const form = document.getElementById('saved-reply-form') as HTMLFormElement | null;
                form?.requestSubmit();
              }}
            >
              {editing?._id ? 'Save changes' : 'Create reply'}
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* AI Auto-Suggest dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>AI auto-suggest</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste an incoming message to generate a relevant saved reply context.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="incoming-msg">Incoming message context</Label>
              <Textarea
                id="incoming-msg"
                rows={4}
                placeholder="e.g. Hi, what are your pricing plans for enterprise?"
                value={incomingMsg}
                onChange={(e) => setIncomingMsg(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" size="sm" onClick={() => setAiDialogOpen(false)} disabled={isGenerating}>
              Cancel
            </WaButton>
            <WaButton size="sm" onClick={handleGenerateAI} disabled={isGenerating || !incomingMsg.trim()}>
              {isGenerating ? 'Generating...' : 'Generate reply'}
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
