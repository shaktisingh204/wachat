'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  EmptyState,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  Textarea,
  zoruSonnerToast,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Label,
  Input,
  Switch,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  EyeOff,
  Flag,
  MessageSquareReply,
  MessagesSquare,
  RefreshCw,
  Trash2,
  Settings,
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

function statusVariant(
  s: 'published' | 'hidden' | 'spam',
): 'success' | 'warning' | 'danger' {
  if (s === 'published') return 'success';
  if (s === 'hidden') return 'warning';
  return 'danger';
}

export default function FacebookVisitorPostsPage(): React.JSX.Element {
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
        keywords: spamKeywords.split(',').map(k => k.trim()).filter(Boolean),
        autoHide,
        autoSpam,
      };
      const res = await saveVisitorPostSpamRules(projectId, rules);
      if (res.success) {
        zoruSonnerToast.success('Spam rules updated successfully.');
        setIsSpamRulesOpen(false);
      } else {
        zoruSonnerToast.error(res.error ?? 'Failed to save rules.');
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
      setSelectedIds(new Set(filtered.map(p => p.id)));
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
      zoruSonnerToast.error('Reply cannot be empty.');
      return;
    }
    startReplying(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('objectId', selected.id);
      fd.set('message', msg);
      const res = await handlePostComment(
        { success: false },
        fd,
      );
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to post reply.');
        return;
      }
      zoruSonnerToast.success('Reply posted.');
      setReplyText('');
    });
  };

  const handleDelete = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleDeleteComment(selected.id, projectId);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to delete.');
        return;
      }
      zoruSonnerToast.success('Visitor post deleted.');
      closeSheet();
      refresh();
    });
  };

  const handleHide = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleHideVisitorPost(selected.id, projectId);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to hide post.');
        return;
      }
      zoruSonnerToast.success('Visitor post hidden.');
      closeSheet();
      refresh();
    });
  };

  const handleSpam = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleMarkVisitorPostSpam(selected.id, projectId);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to mark as spam.');
        return;
      }
      zoruSonnerToast.success('Visitor post marked as spam.');
      closeSheet();
      refresh();
    });
  };

  const handleLike = () => {
    if (!selected || !projectId) return;
    startActing(async () => {
      const res = await handleLikeObject(selected.id, projectId);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Failed to like.');
        return;
      }
      zoruSonnerToast.success('Liked.');
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
        zoruSonnerToast.success(`Successfully processed ${successCount} post(s).`);
      } else {
        zoruSonnerToast.warning(`Processed ${successCount}, failed ${failCount}.`);
      }
      setSelectedIds(new Set());
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<MessagesSquare />}
          title="No project selected"
          description="Pick a Facebook page / project to moderate visitor posts."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Visitor Posts</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Visitor posts</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Posts submitted by visitors on the connected Facebook Page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openSpamRules}>
            <Settings className="mr-2 h-4 w-4" />
            Spam Rules
          </Button>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as StatusFilter)}
          >
            <ZoruSelectTrigger className="w-[160px]">
              <ZoruSelectValue placeholder="Filter" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All</ZoruSelectItem>
              <ZoruSelectItem value="published">Published</ZoruSelectItem>
              <ZoruSelectItem value="hidden">Hidden</ZoruSelectItem>
              <ZoruSelectItem value="spam">Spam</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load visitor posts</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
          <div className="text-sm font-medium text-[var(--st-text)]">
            {selectedIds.size} post(s) selected
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('hide')} disabled={acting}>
              <EyeOff className="mr-2 h-4 w-4" /> Hide
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('spam')} disabled={acting}>
              <Flag className="mr-2 h-4 w-4" /> Mark Spam
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')} disabled={acting}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      )}

      <Card>
        <ZoruCardContent className="pt-6">
          {loading && posts.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare />}
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
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
                <span className="text-sm font-medium text-[var(--st-text)]">Select All</span>
              </div>
              <ul className="flex flex-col gap-2">
                {filtered.map((p) => {
                  const status = inferStatus(p);
                  const preview = (p.message ?? p.story ?? '').trim() || '(no text)';
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <li key={p.id} className="flex items-start gap-3">
                      <div className="pt-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(p.id)}
                          aria-label={`Select post by ${p.from?.name}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(p);
                          setReplyText('');
                        }}
                        className="flex w-full flex-col gap-1 rounded-md border border-[var(--st-border)] px-3 py-2 text-left transition hover:bg-[var(--st-bg-muted)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium text-[var(--st-text)]">
                            {p.from?.name ?? 'Unknown visitor'}
                          </span>
                          <Badge variant={statusVariant(status)}>{status}</Badge>
                        </div>
                        <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                          {preview}
                        </p>
                        <span className="text-[11px] text-[var(--st-text-tertiary)]">
                          {fmtDate(p.created_time)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && closeSheet()}
      >
        <ZoruSheetContent className="w-full sm:max-w-lg">
          <ZoruSheetHeader>
            <ZoruSheetTitle>
              {selected?.from?.name ?? 'Visitor post'}
            </ZoruSheetTitle>
            <ZoruSheetDescription>
              {selected ? fmtDate(selected.created_time) : ''}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {selected ? (
            <div className="flex flex-col gap-4 pt-4">
              <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
                {selected.message ?? selected.story ?? '(no text)'}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(inferStatus(selected))}>
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
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={replying || !replyText.trim()}
                  >
                    <MessageSquareReply className="mr-2 h-4 w-4" />
                    {replying ? 'Posting...' : 'Post reply'}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[var(--st-border)] pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleLike}
                  disabled={acting}
                >
                  Like
                </Button>
                <Button size="sm" variant="ghost" onClick={handleHide} disabled={acting}>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide
                </Button>
                <Button size="sm" variant="ghost" onClick={handleSpam} disabled={acting}>
                  <Flag className="mr-2 h-4 w-4" />
                  Mark spam
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={acting}
                  className="ml-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ) : null}
        </ZoruSheetContent>
      </Sheet>

      <Dialog open={isSpamRulesOpen} onOpenChange={setIsSpamRulesOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Spam Detection Rules</ZoruDialogTitle>
            <ZoruDialogDescription>
              Configure automated actions for new visitor posts.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="keywords">Spam Keywords (comma separated)</Label>
              <Input
                id="keywords"
                value={spamKeywords}
                onChange={(e) => setSpamKeywords(e.target.value)}
                placeholder="e.g. crypto, click here, invest"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-hide" className="flex flex-col gap-1">
                <span>Auto-Hide</span>
                <span className="font-normal text-xs text-[var(--st-text-secondary)]">Automatically hide posts containing these keywords.</span>
              </Label>
              <Switch id="auto-hide" checked={autoHide} onCheckedChange={setAutoHide} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-spam" className="flex flex-col gap-1">
                <span>Auto-Spam</span>
                <span className="font-normal text-xs text-[var(--st-text-secondary)]">Automatically mark posts containing these keywords as spam.</span>
              </Label>
              <Switch id="auto-spam" checked={autoSpam} onCheckedChange={setAutoSpam} />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setIsSpamRulesOpen(false)} disabled={savingRules}>
              Cancel
            </Button>
            <Button onClick={handleSaveSpamRules} disabled={savingRules}>
              {savingRules ? 'Saving...' : 'Save Rules'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
