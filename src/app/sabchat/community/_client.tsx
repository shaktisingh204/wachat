"use client";

import * as React from "react";
import {
  ArrowBigUp,
  Check,
  CheckCircle2,
  Lock,
  Pin,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  createPost,
  createTopic,
  deletePost,
  deleteTopic,
  getTopic,
  listTopics,
  markAnswer,
  updateTopic,
  upvotePost,
  upvoteTopic,
} from "@/app/actions/sabchat-community.actions";
import type {
  SabChatCommunityPost,
  SabChatCommunityTopic,
  SabChatCommunityTopicStatus,
} from "@/lib/rust-client/sabchat-community";

function rel(iso?: string): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function statusTone(s: SabChatCommunityTopicStatus): "success" | "warning" | "neutral" {
  if (s === "answered") return "success";
  if (s === "closed") return "neutral";
  return "warning";
}

export function CommunityClient({
  initialTopics,
}: {
  initialTopics: SabChatCommunityTopic[];
}) {
  const { toast } = useToast();
  const [topics, setTopics] = React.useState(initialTopics);
  const [sort, setSort] = React.useState<"recent" | "top">("recent");
  const [statusFilter, setStatusFilter] = React.useState<SabChatCommunityTopicStatus | "all">("all");
  const [selected, setSelected] = React.useState<SabChatCommunityTopic | null>(null);
  const [posts, setPosts] = React.useState<SabChatCommunityPost[]>([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newBody, setNewBody] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [reply, setReply] = React.useState("");
  const [replying, setReplying] = React.useState(false);

  const refreshList = React.useCallback(
    async (s = sort, st = statusFilter) => {
      const list = await listTopics({
        sort: s,
        status: st === "all" ? undefined : st,
      });
      setTopics(list);
    },
    [sort, statusFilter],
  );

  const openTopic = async (t: SabChatCommunityTopic) => {
    setSelected(t);
    setLoadingDetail(true);
    const detail = await getTopic(t._id);
    setLoadingDetail(false);
    if (detail) {
      setSelected(detail.topic);
      setPosts(detail.posts);
    }
  };

  const reloadDetail = async () => {
    if (!selected) return;
    const detail = await getTopic(selected._id);
    if (detail) {
      setSelected(detail.topic);
      setPosts(detail.posts);
    }
    void refreshList();
  };

  const create = async () => {
    setCreating(true);
    const res = await createTopic({ title: newTitle, body: newBody, category: newCategory });
    setCreating(false);
    if (res.ok) {
      toast({ title: "Posted to community" });
      setComposeOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewCategory("");
      void refreshList();
    } else {
      toast({ title: "Couldn't post", description: res.error, variant: "destructive" });
    }
  };

  const doReply = async () => {
    if (!selected) return;
    setReplying(true);
    const res = await createPost(selected._id, reply);
    setReplying(false);
    if (res.ok) {
      setReply("");
      void reloadDetail();
    } else {
      toast({ title: "Couldn't reply", description: res.error, variant: "destructive" });
    }
  };

  const onUpvoteTopic = async (t: SabChatCommunityTopic) => {
    const res = await upvoteTopic(t._id);
    if (res.ok) {
      setTopics((prev) =>
        prev.map((x) => (x._id === t._id ? { ...x, upvotes: res.result.upvotes } : x)),
      );
      if (selected?._id === t._id) setSelected({ ...selected, upvotes: res.result.upvotes });
    }
  };

  const onUpvotePost = async (p: SabChatCommunityPost) => {
    const res = await upvotePost(p._id);
    if (res.ok)
      setPosts((prev) => prev.map((x) => (x._id === p._id ? { ...x, upvotes: res.result.upvotes } : x)));
  };

  const moderate = async (
    patch: Parameters<typeof updateTopic>[1],
    okMsg: string,
  ) => {
    if (!selected) return;
    const res = await updateTopic(selected._id, patch);
    if (res.ok) {
      toast({ title: okMsg });
      void reloadDetail();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const removeTopic = async () => {
    if (!selected) return;
    const res = await deleteTopic(selected._id);
    if (res.ok) {
      toast({ title: "Topic deleted" });
      setSelected(null);
      setPosts([]);
      void refreshList();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const accept = async (p: SabChatCommunityPost) => {
    if (!selected) return;
    const res = await markAnswer(p._id, selected._id);
    if (res.ok) {
      toast({ title: "Answer accepted" });
      void reloadDetail();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const removePost = async (p: SabChatCommunityPost) => {
    if (!selected) return;
    const res = await deletePost(p._id, selected._id);
    if (res.ok) void reloadDetail();
    else toast({ title: "Failed", description: res.error, variant: "destructive" });
  };

  const STATUS_TABS: { id: SabChatCommunityTopicStatus | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Unanswered" },
    { id: "answered", label: "Answered" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Community</PageTitle>
          <PageDescription>
            A public Q&amp;A forum — customers and agents ask, answer, and upvote.
            Accepted answers become self-service content.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setStatusFilter(t.id);
                void refreshList(sort, t.id);
              }}
              className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                statusFilter === t.id
                  ? "bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]"
                  : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = sort === "recent" ? "top" : "recent";
              setSort(next);
              void refreshList(next, statusFilter);
            }}
            className="text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            Sort: {sort === "recent" ? "Recent" : "Top"}
          </button>
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setComposeOpen(true)}>
            New topic
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        {/* Topic list */}
        <Card className="divide-y divide-[var(--st-border)] p-0">
          {topics.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
              No topics yet. Start the conversation.
            </p>
          ) : (
            topics.map((t) => (
              <div
                key={t._id}
                className={`flex items-start gap-3 p-3 ${
                  selected?._id === t._id ? "bg-[var(--st-bg-muted)]" : ""
                }`}
              >
                <button
                  onClick={() => void onUpvoteTopic(t)}
                  className="flex w-9 shrink-0 flex-col items-center rounded-md py-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                  title="Upvote"
                >
                  <ArrowBigUp className="h-4 w-4" aria-hidden />
                  <span className="text-xs font-semibold">{t.upvotes}</span>
                </button>
                <button className="min-w-0 flex-1 text-left" onClick={() => void openTopic(t)}>
                  <div className="flex items-center gap-1.5">
                    {t.pinned ? <Pin className="h-3 w-3 shrink-0 text-amber-500" aria-hidden /> : null}
                    <span className="truncate text-sm font-medium text-[var(--st-text)]">
                      {t.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                    <span>{t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"}</span>
                    <span>· {rel(t.lastActivityAt)}</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </Card>

        {/* Detail */}
        <Card className="p-0">
          {!selected ? (
            <p className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-[var(--st-text-secondary)]">
              Select a topic to read and reply.
            </p>
          ) : (
            <div className="flex max-h-[70vh] flex-col">
              <div className="border-b border-[var(--st-border)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--st-text)]">{selected.title}</h2>
                  <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--st-text)]">
                  {selected.body}
                </p>
                <p className="mt-2 text-xs text-[var(--st-text-secondary)]">
                  {selected.authorName || "Anonymous"} · {rel(selected.createdAt)}
                </p>
                {/* Moderation row */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Pin}
                    onClick={() => void moderate({ pinned: !selected.pinned }, selected.pinned ? "Unpinned" : "Pinned")}
                  >
                    {selected.pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Lock}
                    onClick={() =>
                      void moderate(
                        { status: selected.status === "closed" ? "open" : "closed" },
                        selected.status === "closed" ? "Reopened" : "Closed",
                      )
                    }
                  >
                    {selected.status === "closed" ? "Reopen" : "Close"}
                  </Button>
                  <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={() => void removeTopic()}>
                    Delete
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {loadingDetail ? (
                  <p className="text-center text-sm text-[var(--st-text-secondary)]">Loading…</p>
                ) : posts.length === 0 ? (
                  <p className="text-center text-sm text-[var(--st-text-secondary)]">
                    No replies yet — be the first to answer.
                  </p>
                ) : (
                  posts.map((p) => (
                    <div
                      key={p._id}
                      className={`rounded-lg border p-3 ${
                        p.isAnswer
                          ? "border-[var(--st-status-ok)] bg-[var(--st-status-ok)]/5"
                          : "border-[var(--st-border)]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => void onUpvotePost(p)}
                          className="flex w-8 shrink-0 flex-col items-center text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                          title="Upvote"
                        >
                          <ArrowBigUp className="h-4 w-4" aria-hidden />
                          <span className="text-xs font-semibold">{p.upvotes}</span>
                        </button>
                        <div className="min-w-0 flex-1">
                          {p.isAnswer ? (
                            <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--st-status-ok)]">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Accepted answer
                            </span>
                          ) : null}
                          <p className="whitespace-pre-wrap text-sm text-[var(--st-text)]">{p.body}</p>
                          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                            {p.authorName || "Anonymous"} · {rel(p.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          {!p.isAnswer ? (
                            <button
                              onClick={() => void accept(p)}
                              title="Accept as answer"
                              className="grid h-7 w-7 place-items-center rounded text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-status-ok)]"
                            >
                              <Check className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                          <button
                            onClick={() => void removePost(p)}
                            title="Delete reply"
                            className="grid h-7 w-7 place-items-center rounded text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selected.status !== "closed" ? (
                <div className="flex items-end gap-2 border-t border-[var(--st-border)] p-3">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="Write a reply…"
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Send}
                    loading={replying}
                    disabled={replying || !reply.trim()}
                    onClick={() => void doReply()}
                  >
                    Reply
                  </Button>
                </div>
              ) : (
                <p className="border-t border-[var(--st-border)] p-3 text-center text-xs text-[var(--st-text-secondary)]">
                  This topic is closed.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New topic</DialogTitle>
          </DialogHeader>
          <Field label="Title">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="How do I…?" autoFocus />
          </Field>
          <Field label="Details">
            <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={5} placeholder="Describe your question…" />
          </Field>
          <Field label="Category (optional)">
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Billing" />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setComposeOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={creating}
              disabled={creating || !newTitle.trim() || !newBody.trim()}
              onClick={() => void create()}
            >
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
