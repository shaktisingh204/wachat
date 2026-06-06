'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  ScrollArea,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  MessageCircle,
  RefreshCw,
  Send,
  ThumbsUp,
  Trash2,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getFacebookPosts,
  getPostComments,
  handleDeleteComment,
  handleLikeObject,
  handlePostComment,
  } from '@/app/actions/facebook.actions';
import type { FacebookPost } from '@/lib/definitions';

/**
 * /dashboard/facebook/comments - Facebook Comments inbox.
 *
 * Two-pane layout: a left rail of recent Facebook posts for the active
 * project, and a right pane that, once a post is selected, loads the
 * post's comments via the wachat-facebook-comments Rust BFF and lets
 * the operator reply, delete, or like a comment.
 */

import * as React from 'react';

interface FacebookComment {
  id: string;
  message?: string;
  from?: { id: string; name?: string; picture?: { data?: { url?: string } } };
  created_time?: string;
  like_count?: number;
  comment_count?: number;
  permalink_url?: string;
}

function previewText(post: FacebookPost): string {
  const raw = (post as { message?: string; story?: string }).message
    ?? (post as { message?: string; story?: string }).story
    ?? '';
  if (!raw) return '(no text)';
  return raw.length > 80 ? raw.slice(0, 77) + '...' : raw;
}

function safeDistance(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function FacebookCommentsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const { toast } = useToast();

  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [isLoadingPosts, startLoadingPosts] = useTransition();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<FacebookComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isLoadingComments, startLoadingComments] = useTransition();

  const [replyText, setReplyText] = useState('');
  const [isPosting, startPosting] = useTransition();

  const loadPosts = useCallback(() => {
    if (!projectId) return;
    startLoadingPosts(async () => {
      const res = await getFacebookPosts(projectId);
      if (res.error) {
        setPostsError(res.error);
        setPosts([]);
        return;
      }
      setPostsError(null);
      setPosts(res.posts ?? []);
    });
  }, [projectId]);

  const loadComments = useCallback(
    (postId: string) => {
      if (!projectId || !postId) return;
      startLoadingComments(async () => {
        const res = await getPostComments(postId, projectId);
        if (res.error) {
          setCommentsError(res.error);
          setComments([]);
          return;
        }
        setCommentsError(null);
        setComments((res.comments as FacebookComment[]) ?? []);
      });
    },
    [projectId],
  );

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!selectedPostId && posts.length > 0) {
      setSelectedPostId(posts[0]?.id ?? null);
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    if (selectedPostId) loadComments(selectedPostId);
  }, [selectedPostId, loadComments]);

  const onPostReply = () => {
    const text = replyText.trim();
    if (!text || !selectedPostId || !projectId) return;
    startPosting(async () => {
      const fd = new FormData();
      fd.set('objectId', selectedPostId);
      fd.set('projectId', projectId);
      fd.set('message', text);
      const res = await handlePostComment({ success: false }, fd);
      if (!res.success) {
        toast({
          title: 'Could not post comment',
          description: res.error ?? 'Unknown error',
          tone: 'danger',
        });
        return;
      }
      setReplyText('');
      toast({ title: 'Comment posted', description: 'Refreshing thread...', tone: 'success' });
      loadComments(selectedPostId);
    });
  };

  const onDelete = (commentId: string) => {
    if (!projectId) return;
    startPosting(async () => {
      const res = await handleDeleteComment(commentId, projectId);
      if (!res.success) {
        toast({
          title: 'Could not delete',
          description: res.error ?? 'Unknown error',
          tone: 'danger',
        });
        return;
      }
      toast({ title: 'Comment deleted', tone: 'success' });
      if (selectedPostId) loadComments(selectedPostId);
    });
  };

  const onLike = (objectId: string) => {
    if (!projectId) return;
    startPosting(async () => {
      const res = await handleLikeObject(objectId, projectId);
      if (!res.success) {
        toast({
          title: 'Could not like',
          description: res.error ?? 'Unknown error',
          tone: 'danger',
        });
        return;
      }
      toast({ title: 'Liked', tone: 'success' });
    });
  };

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={MessageCircle}
          title="No project selected"
          description="Pick a Facebook page / project from the project switcher to see its comments."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Comments</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Comments</PageTitle>
          <PageDescription>
            Read and reply to comments on this page&apos;s Facebook posts.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            onClick={loadPosts}
            disabled={isLoadingPosts}
            iconLeft={RefreshCw}
          >
            Refresh posts
          </Button>
        </PageActions>
      </PageHeader>

      {postsError && (
        <Alert tone="danger" icon={AlertCircle}>
          <AlertTitle>Could not load posts</AlertTitle>
          <AlertDescription>{postsError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card padding="sm" className="flex flex-col gap-2">
          <p className="px-2 pt-1 text-xs uppercase tracking-wider text-[var(--st-text-secondary)]">
            Recent posts
          </p>
          <ScrollArea className="h-[640px] pr-1">
            {isLoadingPosts && posts.length === 0 ? (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : posts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={MessageCircle}
                title="No posts yet"
                description="Once this page has posts, they will appear here."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {posts.map((post) => {
                  const isActive = post.id === selectedPostId;
                  return (
                    <li key={post.id}>
                      <Button
                        variant="ghost"
                        block
                        onClick={() => setSelectedPostId(post.id)}
                        aria-pressed={isActive}
                        className={
                          'h-auto justify-start whitespace-normal border-transparent px-3 py-2 text-left [&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:flex-col [&_.u-btn__label]:items-start [&_.u-btn__label]:overflow-visible ' +
                          (isActive ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : '')
                        }
                      >
                        <span className="line-clamp-2 block w-full">{previewText(post)}</span>
                        <span className="mt-1 block text-[11px] text-[var(--st-text-secondary)]">
                          {safeDistance((post as { created_time?: string }).created_time)}
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </Card>

        <Card padding="lg" className="flex flex-col gap-4">
          {!selectedPost ? (
            <EmptyState
              icon={MessageCircle}
              title="Pick a post"
              description="Select a post on the left to see its comments."
            />
          ) : (
            <>
              <header className="flex items-start justify-between gap-3 border-b border-[var(--st-border)] pb-3">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-[var(--st-text-secondary)]">
                    Selected post
                  </p>
                  <p className="mt-1 text-sm text-[var(--st-text)]">{previewText(selectedPost)}</p>
                  <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
                    {safeDistance((selectedPost as { created_time?: string }).created_time)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => onLike(selectedPost.id)}
                    disabled={isPosting}
                    iconLeft={ThumbsUp}
                  >
                    Like
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => loadComments(selectedPost.id)}
                    disabled={isLoadingComments}
                    iconLeft={RefreshCw}
                  >
                    Refresh
                  </Button>
                </div>
              </header>

              {commentsError && (
                <Alert tone="danger" icon={AlertCircle}>
                  <AlertTitle>Could not load comments</AlertTitle>
                  <AlertDescription>{commentsError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3">
                {isLoadingComments && comments.length === 0 ? (
                  <>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                ) : comments.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="No comments yet"
                    description="When users comment on this post, they will show up here."
                  />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {comments.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                          {c.from?.picture?.data?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.from.picture.data.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-[var(--st-text)]">
                              {c.from?.name || 'Unknown'}
                            </span>
                            <span className="text-[11px] text-[var(--st-text-secondary)]">
                              {safeDistance(c.created_time)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--st-text)]">
                            {c.message ?? '(no message)'}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--st-text-secondary)]">
                            <span>{c.like_count ?? 0} likes</span>
                            <span>{c.comment_count ?? 0} replies</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            label="Like comment"
                            icon={ThumbsUp}
                            size="sm"
                            onClick={() => onLike(c.id)}
                            disabled={isPosting}
                          />
                          <IconButton
                            label="Delete comment"
                            icon={Trash2}
                            size="sm"
                            onClick={() => onDelete(c.id)}
                            disabled={isPosting}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="mt-auto flex items-center gap-2 border-t border-[var(--st-border)] pt-3">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a comment as the page..."
                  aria-label="Write a comment as the page"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onPostReply();
                    }
                  }}
                  disabled={isPosting}
                  className="flex-1"
                />
                <Button
                  variant="primary"
                  onClick={onPostReply}
                  disabled={isPosting || !replyText.trim()}
                  iconLeft={Send}
                >
                  Post
                </Button>
              </footer>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
