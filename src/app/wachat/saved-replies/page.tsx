'use client';

import {
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
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

import { useProject } from '@/context/project-context';
import {
  getSavedReplies,
  saveSavedReply,
  deleteSavedReply,
} from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [replies, setReplies] = useState<Reply[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Reply> | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [formCategory, setFormCategory] = useState('General');

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
      setFormCategory(editing?.category ?? 'General');
    }
  }, [dialogOpen, editing]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getSavedReplies(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
      toast({ title: 'Error', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: res.message ?? 'Reply saved.', tone: 'success' });
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSavedReply(id);
      if (!res.success) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Reply deleted.', tone: 'success' });
      load();
    });
  };

  const handleGenerateAI = () => {
    if (!incomingMsg.trim()) {
      toast({ title: 'Please enter an incoming message.', tone: 'danger' });
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
      toast({ title: 'AI suggestion generated successfully.', tone: 'success' });
    }, 1500);
  };

  const columns = useMemo<DataTableColumn<Reply>[]>(
    () => [
      {
        key: 'shortcut',
        header: 'Shortcut',
        render: (row) => (
          <span className="font-mono text-[12px]" style={{ color: 'var(--st-text)' }}>
            {row.shortcut}
          </span>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        render: (row) => (
          <span className="truncate" style={{ color: 'var(--st-text)' }}>{row.title}</span>
        ),
      },
      {
        key: 'body',
        header: 'Body',
        render: (row) => (
          <span className="line-clamp-1" style={{ color: 'var(--st-text-secondary)' }}>
            {row.body}
          </span>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        render: (row) => <Badge kind="outline">{row.category}</Badge>,
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              label="Edit reply"
              icon={Pencil}
              size="sm"
              onClick={() => openEdit(row)}
            />
            <IconButton
              label="Delete reply"
              icon={Trash2}
              size="sm"
              onClick={() => handleDelete(row._id)}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Saved Replies' },
      ]}
      eyebrow="WaChat"
      title="Saved Replies"
      description={
        <>
          Create shortcut replies your team can use in conversations. Press{' '}
          <kbd
            className="rounded px-1 font-mono text-[10px]"
            style={{
              border: '1px solid var(--st-border)',
              background: 'var(--st-bg-secondary)',
              color: 'var(--st-text-secondary)',
            }}
          >
            Cmd+K
          </kbd>{' '}
          to search or{' '}
          <kbd
            className="rounded px-1 font-mono text-[10px]"
            style={{
              border: '1px solid var(--st-border)',
              background: 'var(--st-bg-secondary)',
              color: 'var(--st-text-secondary)',
            }}
          >
            Cmd+N
          </kbd>{' '}
          for a new reply.
        </>
      }
      actions={
        <>
          <Button variant="outline" iconLeft={Wand2} onClick={() => setAiDialogOpen(true)}>
            AI Suggest
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New reply
          </Button>
        </>
      }
    >
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-[300px]">
          <Input
            ref={searchInputRef}
            iconLeft={Search}
            placeholder="Search replies..."
            aria-label="Search saved replies"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <Select
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v ?? 'All')}
            options={FILTER_CATEGORIES}
            placeholder="Category"
            aria-label="Filter by category"
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-6">
        {isPending && replies.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={48} radius={8} />
            ))}
          </div>
        ) : replies.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No saved replies yet"
            description="Create shortcuts your team can drop into any conversation."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                New reply
              </Button>
            }
          />
        ) : filteredReplies.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No results found"
            description="No saved replies match your current search and filters."
          />
        ) : (
          <Card padding="sm">
            <DataTable
              columns={columns}
              rows={filteredReplies}
              getRowId={(row) => row._id}
            />
          </Card>
        )}
      </div>

      {/* Create / edit dialog */}
      <Modal
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        title={editing?._id ? 'Edit reply' : 'New reply'}
        description="Fill in the shortcut and body. Optional media URL is supported."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="saved-reply-form">
              {editing?._id ? 'Save changes' : 'Create reply'}
            </Button>
          </>
        }
      >
        <form
          action={handleSave}
          className="flex flex-col gap-4"
          id="saved-reply-form"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Shortcut" required>
              <Input
                name="shortcut"
                placeholder="/greeting"
                required
                defaultValue={editing?.shortcut ?? ''}
              />
            </Field>
            <Field label="Title">
              <Input
                name="title"
                placeholder="Quick hello"
                defaultValue={editing?.title ?? ''}
              />
            </Field>
          </div>

          <Field label="Category">
            <Select
              value={formCategory}
              onChange={(v) => setFormCategory(v ?? 'General')}
              options={CATEGORIES}
              placeholder="Pick a category"
              aria-label="Category"
            />
            <input type="hidden" name="category" value={formCategory} />
          </Field>

          <Field label="Body" required>
            <Textarea
              name="body"
              rows={4}
              required
              defaultValue={editing?.body ?? ''}
              placeholder="Type the reply body…"
            />
          </Field>

          <Field label="Media URL (optional)">
            <SabFileUrlInput
              id="mediaUrl"
              name="mediaUrl"
              placeholder="https://…"
              accept="all"
              value={mediaUrl}
              onChange={(v) => setMediaUrl(v)}
            />
          </Field>
        </form>
      </Modal>

      {/* AI Auto-Suggest dialog */}
      <Modal
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        title="AI Auto-Suggest"
        description="Paste an incoming message to generate a relevant saved reply context."
        footer={
          <>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateAI}
              loading={isGenerating}
              disabled={isGenerating || !incomingMsg.trim()}
            >
              {isGenerating ? 'Generating...' : 'Generate Reply'}
            </Button>
          </>
        }
      >
        <Field label="Incoming Message Context">
          <Textarea
            rows={4}
            placeholder="e.g. Hi, what are your pricing plans for the enterprise edition?"
            value={incomingMsg}
            onChange={(e) => setIncomingMsg(e.target.value)}
          />
        </Field>
      </Modal>
    </WachatPage>
  );
}
