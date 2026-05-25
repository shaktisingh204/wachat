'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DataTable,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
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
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import {
  getSavedReplies,
  saveSavedReply,
  deleteSavedReply,
} from '@/app/actions/wachat-features.actions';

import * as React from 'react';

import { SabFileUrlInput } from '@/components/sabfiles';

const FILTER_CATEGORIES = [
  { value: 'All', label: 'All Categories' },
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
    if (s[sIdx] === p[pIdx]) {
      pIdx++;
    }
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // AI Suggest state
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

  // Keyboard Shortcuts
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
    return replies.filter(r => {
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
    // Simulate AI generation delay
    setTimeout(() => {
      const suggestion: Partial<Reply> = {
        title: 'AI Auto Reply',
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

  const columns = useMemo<ColumnDef<Reply>[]>(
    () => [
      {
        accessorKey: 'shortcut',
        header: 'Shortcut',
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-zoru-ink">
            {row.original.shortcut}
          </span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <span className="truncate text-zoru-ink">{row.original.title}</span>
        ),
      },
      {
        accessorKey: 'body',
        header: 'Body',
        cell: ({ row }) => (
          <span className="line-clamp-1 text-zoru-ink-muted">
            {row.original.body}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.category}</Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit"
              onClick={() => openEdit(row.original as Reply)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => handleDelete(row.original._id)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Saved Replies</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat</ZoruPageEyebrow>
          <ZoruPageTitle>Saved Replies</ZoruPageTitle>
          <ZoruPageDescription>
            Create shortcut replies your team can use in conversations. Press <kbd className="rounded border bg-zoru-surface px-1 font-mono text-[10px] text-zoru-ink-muted shadow-sm">Cmd+K</kbd> to search or <kbd className="rounded border bg-zoru-surface px-1 font-mono text-[10px] text-zoru-ink-muted shadow-sm">Cmd+N</kbd> for a new reply.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Wand2 className="mr-2 h-4 w-4" /> AI Suggest
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New reply
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <Input
            ref={searchInputRef}
            placeholder="Search replies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <ZoruSelectTrigger className="w-full sm:w-[180px]">
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

      <div className="mt-6">
        {isPending && replies.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : replies.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title="No saved replies yet"
            description="Create shortcuts your team can drop into any conversation."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> New reply
              </Button>
            }
          />
        ) : filteredReplies.length === 0 ? (
           <EmptyState
             icon={<Search />}
             title="No results found"
             description="No saved replies match your current search and filters."
           />
        ) : (
          <Card className="p-4">
            <DataTable
              columns={columns}
              data={filteredReplies}
            />
          </Card>
        )}
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
            <ZoruDialogTitle>
              {editing?._id ? 'Edit reply' : 'New reply'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Fill in the shortcut and body. Optional media URL is supported.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form
            action={handleSave}
            className="flex flex-col gap-4"
            id="saved-reply-form"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shortcut">Shortcut</Label>
                <Input
                  id="shortcut"
                  name="shortcut"
                  placeholder="/greeting"
                  required
                  defaultValue={editing?.shortcut ?? ''}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Quick hello"
                  defaultValue={editing?.title ?? ''}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                name="category"
                defaultValue={editing?.category ?? 'General'}
              >
                <ZoruSelectTrigger id="category">
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
                placeholder="Type the reply body…"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mediaUrl">Media URL (optional)</Label>
              <SabFileUrlInput
                id="mediaUrl"
                name="mediaUrl"
                placeholder="https://…"
                accept="all"
                value={mediaUrl}
                onChange={(v) => setMediaUrl(v)}
              />
            </div>
          </form>

          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="saved-reply-form">
              {editing?._id ? 'Save changes' : 'Create reply'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* AI Auto-Suggest dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>AI Auto-Suggest</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste an incoming message to generate a relevant saved reply context.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-4 py-2">
             <div className="flex flex-col gap-1.5">
                <Label htmlFor="incoming-msg">Incoming Message Context</Label>
                <Textarea
                  id="incoming-msg"
                  rows={4}
                  placeholder="e.g. Hi, what are your pricing plans for the enterprise edition?"
                  value={incomingMsg}
                  onChange={(e) => setIncomingMsg(e.target.value)}
                />
             </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateAI} disabled={isGenerating || !incomingMsg.trim()}>
              {isGenerating ? 'Generating...' : 'Generate Reply'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

