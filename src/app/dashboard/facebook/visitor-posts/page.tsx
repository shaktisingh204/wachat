'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  EyeOff,
  Flag,
  MessageSquareReply,
  MessagesSquare,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useProject } from '@/context/project-context';
import {
  getVisitorPosts,
  handleDeleteComment,
  handlePostComment,
  handleLikeObject,
  handleHideVisitorPost,
  handleMarkVisitorPostSpam,
  getVisitorPostSpamRules,
  saveVisitorPostSpamRules,
} from '@/app/actions/facebook.actions';

import * as React from 'react';

type StatusFilter = 'all' | 'published' | 'hidden' | 'spam';

interface VisitorPost {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  status?: string;
  is_hidden?: boolean;
  is_published?: boolean;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function inferStatus(p: VisitorPost): 'published' | 'hidden' | 'spam' {
  if ((p.status ?? '').toLowerCase() === 'spam') return 'spam';
  if (p.is_hidden || (p.status ?? '').toLowerCase() === 'hidden') return 'hidden';
  return 'published';
}

function statusTone(
  s: 'published' | 'hidden' | 'spam',
): 'success' | 'warning' | 'danger' {
  if (s === 'published') return 'success';
  if (s === 'hidden') return 'warning';
  return 'danger';
}

export default function FacebookVisitorPostsPage(): React.JSX.Element {
  const { toast } = useToast();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [posts, setPosts] = useState<VisitorPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [filter, setFilter] = useState<StatusFilter>('all');

  const [selected, setSelected] = useState<VisitorPost | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, startReplying] = useTransition();
  const [acting, startActing] = useTransition();

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Spam rules
  const [isSpamRulesOpen, setIsSpamRulesOpen] = useState(false);
  const [spamKeywords, setSpamKeywords] = useState('');
  const [autoHide, setAutoHide] = useState(false);
  const [autoSpam, setAutoSpam] = useState(false);
  const [savingRules, startSavingRules] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getVisitorPosts(projectId);
      if (res.error) {
        setError(res.error);
        setPosts([]);
        return;
      }
      setError(null);
      setPosts((res.posts as VisitorPost[]) ?? []);
      setSelectedIds(new Set()); // Clear selection on refresh
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadSpamRules = useCallback(async () => {
    if (!projectId) return;
    const res = await getVisitorPostSpamRules(projectId);
    if (res.rules) {
      setSpamKeywords(res.rules.keywords.join(', '));
      setAutoHide(res.rules.autoHide);
      setAutoSpam(res.rules.autoSpam);
    }
  }, [projectId]);

  const openSpamRules = () => {
    loadSpamRules();
    setIsSpamRulesOpen(true);
  };

  const handleSaveSpamRules = () => {
    startSavingRules(async () => {
      const rules = {
        keywords: spamKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        autoHide,
        autoSpam,
      };
      const res = await saveVisitorPostSpamRules(projectId, rules);
      if (res.success) {
        toast.success('Spam rules updated successfully.');
        setIsSpamRulesOpen(false);
      } else {
        toast.error(res.error ?? 'Failed to save rules.');
      }
    });
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return posts;
    return posts.filter((p) => inferStatus(p) === filter);
  }, [posts, filter]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const closeSheet = () => {
    setSelected(null);
    setReplyText('');
  };

  const handleReply = () => {
    if (!selected || !projectId) return;
    const msg = replyText.trim();
    if (!msg) {
      toast.error('Reply cannot be empty.');
      return;
    }
    startReplying(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('objectId', selected.id);
      fd.set('message', msg);
      const res = await handlePostComment({ success: false }, fd);
      if (!res.success) {
        toast.error(res.error ?? 'Failed to post reply.');
        return;
      }
      toast.success('Reply posted.');
      setReplyText('');
    });
  };

  const handleDelete = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleDeleteComment(selected.id, projectId);
      if (!res.success) {
        toast.error(res.error ?? 'Failed to delete.');
        return;
      }
      toast.success('Visitor post deleted.');
      closeSheet();
      refresh();
    });
  };

  const handleHide = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleHideVisitorPost(selected.id, projectId);
      if (!res.success) {
        toast.error(res.error ?? 'Failed to hide post.');
        return;
      }
      toast.success('Visitor post hidden.');
      closeSheet();
      refresh();
    });
  };

  const handleSpam = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleMarkVisitorPostSpam(selected.id, projectId);
      if (!res.success) {
        toast.error(res.error ?? 'Failed to mark as spam.');
        return;
      }
      toast.success('Visitor post marked as spam.');
      closeSheet();
      refresh();
    });
  };

  const handleLike = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleLikeObject(selected.id, projectId);
      if (!res.success) {
        toast.error(res.error ?? 'Failed to like.');
        return;
      }
      toast.success('Liked.');
    });
  };

  const handleBulkAction = async (action: 'hide' | 'spam' | 'delete') => {
    if (selectedIds.size === 0 || !projectId) return;
    startActing(async () => {
      let successCount = 0;
      let failCount = 0;

      for (const id of Array.from(selectedIds)) {
        let res;
        if (action === 'hide') {
          res = await handleHideVisitorPost(id, projectId);
        } else if (action === 'spam') {
          res = await handleMarkVisitorPostSpam(id, projectId);
        } else {
          res = await handleDeleteComment(id, projectId);
        }

        if (res.success) successCount++;
        else failCount++;
      }

      if (failCount === 0) {
        toast.success(`Successfully processed ${successCount} post(s).`);
      } else {
        toast.warning(`Processed ${successCount}, failed ${failCount}.`);
      }
      setSelectedIds(new Set());
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={MessagesSquare}
          title="No project selected"
          description="Pick a Facebook page / project to moderate visitor posts."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Visitor Posts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Visitor posts</PageTitle>
          <PageDescription>
            Posts submitted by visitors on the connected Facebook Page.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Settings} onClick={openSpamRules}>
            Spam rules
          </Button>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]" aria-label="Filter posts by status">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            iconLeft={RefreshCw}
            onClick={refresh}
            disabled={loading}
            loading={loading}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load visitor posts</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {selectedIds.size > 0 && (
        <Card padding="sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[var(--st-text)]">
              {selectedIds.size} post(s) selected
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                iconLeft={EyeOff}
                onClick={() => handleBulkAction('hide')}
                disabled={acting}
              >
                Hide
              </Button>
              <Button
                size="sm"
                variant="outline"
                iconLeft={Flag}
                onClick={() => handleBulkAction('spam')}
                disabled={acting}
              >
                Mark spam
              </Button>
              <Button
                size="sm"
                variant="danger"
                iconLeft={Trash2}
                onClick={() => handleBulkAction('delete')}
                disabled={acting}
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardBody>
          {loading && posts.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton height={56} className="w-full" />
              <Skeleton height={56} className="w-full" />
              <Skeleton height={56} className="w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title={posts.length === 0 ? 'No visitor posts' : 'No matches'}
              description={
                posts.length === 0
                  ? "This Page hasn't received any visitor posts yet."
                  : 'Try a different status filter.'
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-3">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all posts"
                />
                <span className="text-sm font-medium text-[var(--st-text)]">
                  Select all
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {filtered.map((p) => {
                  const status = inferStatus(p);
                  const preview = (p.message ?? p.story ?? '').trim() || '(no text)';
                  const isSelected = selectedIds.has(p.id);
                  const authorName = p.from?.name ?? 'Unknown visitor';
                  const openPost = () => {
                    setSelected(p);
                    setReplyText('');
                  };
                  return (
                    <li key={p.id} className="flex items-start gap-3">
                      <div className="pt-3">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleSelection(p.id)}
                          aria-label={`Select post by ${authorName}`}
                        />
                      </div>
                      <Card
                        variant="interactive"
                        padding="none"
                        role="button"
                        tabIndex={0}
                        aria-label={`Open visitor post by ${authorName}`}
                        onClick={openPost}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openPost();
                          }
                        }}
                        className="flex w-full flex-col gap-1 px-3 py-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium text-[var(--st-text)]">
                            {authorName}
                          </span>
                          <Badge tone={statusTone(status)}>{status}</Badge>
                        </div>
                        <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                          {preview}
                        </p>
                        <span className="text-[11px] text-[var(--st-text-tertiary)]">
                          {fmtDate(p.created_time)}
                        </span>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.from?.name ?? 'Visitor post'}</SheetTitle>
            <SheetDescription>
              {selected ? fmtDate(selected.created_time) : ''}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="flex flex-col gap-4 pt-4">
              <Card padding="sm">
                <div className="text-sm text-[var(--st-text)]">
                  {selected.message ?? selected.story ?? '(no text)'}
                </div>
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(inferStatus(selected))}>
                  {inferStatus(selected)}
                </Badge>
                <Badge variant="outline">id: {selected.id}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Reply
                </p>
                <Textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply as the Page..."
                  aria-label="Reply to visitor post"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    iconLeft={MessageSquareReply}
                    onClick={handleReply}
                    disabled={replying || !replyText.trim()}
                    loading={replying}
                  >
                    {replying ? 'Posting...' : 'Post reply'}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[var(--st-border)] pt-3">
                <Button size="sm" variant="ghost" onClick={handleLike} disabled={acting}>
                  Like
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={EyeOff}
                  onClick={handleHide}
                  disabled={acting}
                >
                  Hide
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={Flag}
                  onClick={handleSpam}
                  disabled={acting}
                >
                  Mark spam
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  iconLeft={Trash2}
                  onClick={handleDelete}
                  disabled={acting}
                  className="ml-auto"
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={isSpamRulesOpen} onOpenChange={setIsSpamRulesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spam detection rules</DialogTitle>
            <DialogDescription>
              Configure automated actions for new visitor posts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Field label="Spam keywords (comma separated)">
              <Input
                value={spamKeywords}
                onChange={(e) => setSpamKeywords(e.target.value)}
                placeholder="e.g. crypto, click here, invest"
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--st-text)]">
                  Auto-hide
                </span>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  Automatically hide posts containing these keywords.
                </span>
              </div>
              <Switch
                checked={autoHide}
                onCheckedChange={setAutoHide}
                aria-label="Auto-hide posts matching keywords"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--st-text)]">
                  Auto-spam
                </span>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  Automatically mark posts containing these keywords as spam.
                </span>
              </div>
              <Switch
                checked={autoSpam}
                onCheckedChange={setAutoSpam}
                aria-label="Auto-mark posts matching keywords as spam"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSpamRulesOpen(false)}
              disabled={savingRules}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSpamRules} disabled={savingRules} loading={savingRules}>
              {savingRules ? 'Saving...' : 'Save rules'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
