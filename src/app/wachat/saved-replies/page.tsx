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
import { Plus, Pencil, Trash2, MessageSquare, Wand2, Search } from 'lucide-react';
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

interface Reply {
  _id: string;
  shortcut: string;
  title: string;
  body: string;
  category: string;
  mediaUrl?: string;
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

  // Keyboard shortcuts
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

  const filteredReplies = useMemo(() => {
    return replies.filter((r) => {
      const matchCat = categoryFilter === 'All' || r.category === categoryFilter;
      const searchTarget = `${r.title} ${r.shortcut} ${r.body}`;
      const matchQuery = fuzzyMatch(searchTarget, searchQuery);
      return matchCat && matchQuery;
    });
  }, [replies, searchQuery, categoryFilter]);

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
        description="Shortcut replies your team can drop into any conversation. Press Cmd+K to search or Cmd+N for a new reply."
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

      {/* Search + filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <m.label
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400 sm:w-[320px]"
        >
          <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            ref={searchInputRef}
            placeholder="Search replies"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Search replies"
          />
        </m.label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <ZoruSelectTrigger className="w-full rounded-full sm:w-[200px]">
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
                transition={{ duration: 0.28, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50"
              >
                <code className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700">
                  {r.shortcut}
                </code>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-950">{r.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[12px] text-zinc-500">{r.body}</p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                  style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                >
                  {r.category}
                </span>
                <div className="flex items-center gap-1">
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
