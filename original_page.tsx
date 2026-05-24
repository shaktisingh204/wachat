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
} from '@/components/zoruui';
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
  } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useProject } from '@/context/project-context';
import {
  getVisitorPosts,
  handleDeleteComment,
  handlePostComment,
  handleLikeObject,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/visitor-posts — User-submitted posts on the Page.
 *
 * Lists visitor posts with author + message preview + status, with a
 * status filter (all/published/hidden/spam). Click a row to open a
 * Sheet for the full message, reply input, hide, and mark-spam
 * actions. Reply uses `handlePostComment`; delete uses `handleDeleteComment`;
 * hide/spam are queued (no dedicated server action yet) and surface a
 * toast — matches the prompt's "render the buttons but call existing
 * handlers / toast.info noting queued" requirement.
 */

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
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return posts;
    return posts.filter((p) => inferStatus(p) === filter);
  }, [posts, filter]);

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
    // No dedicated server action exists yet — surface as queued per spec.
    zoruSonnerToast.info('Hide queued — awaiting Page-content BFF.');
  };

  const handleSpam = () => {
    zoruSonnerToast.info('Marked as spam — queued for moderation BFF.');
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
          <h1 className="text-2xl text-zoru-ink">Visitor posts</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Posts submitted by visitors on the connected Facebook Page.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <ul className="flex flex-col gap-2">
              {filtered.map((p) => {
                const status = inferStatus(p);
                const preview = (p.message ?? p.story ?? '').trim() || '(no text)';
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(p);
                        setReplyText('');
                      }}
                      className="flex w-full flex-col gap-1 rounded-md border border-zoru-line px-3 py-2 text-left transition hover:bg-zoru-surface-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-medium text-zoru-ink">
                          {p.from?.name ?? 'Unknown visitor'}
                        </span>
                        <Badge variant={statusVariant(status)}>{status}</Badge>
                      </div>
                      <p className="line-clamp-2 text-xs text-zoru-ink-muted">
                        {preview}
                      </p>
                      <span className="text-[11px] text-zoru-ink-subtle">
                        {fmtDate(p.created_time)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
              <div className="rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-sm text-zoru-ink">
                {selected.message ?? selected.story ?? '(no text)'}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(inferStatus(selected))}>
                  {inferStatus(selected)}
                </Badge>
                <Badge variant="outline">id: {selected.id}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
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

              <div className="flex flex-wrap gap-2 border-t border-zoru-line pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleLike}
                  disabled={acting}
                >
                  Like
                </Button>
                <Button size="sm" variant="ghost" onClick={handleHide}>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide
                </Button>
                <Button size="sm" variant="ghost" onClick={handleSpam}>
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
    </div>
  );
}
