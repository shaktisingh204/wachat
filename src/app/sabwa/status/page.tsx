
"use client";

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
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  EmptyState,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  Input,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Plus,
  Repeat2,
  Send,
  Smartphone,
  Type as TypeIcon,
  Users,
  X,
  MessageCircle,
} from "lucide-react";

import * as React from "react";
import Link from "next/link";

import { SabFilePickerButton } from "@/components/sabfiles";
import type { SabFilePick } from "@/components/sabfiles";
import { useChats } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import { listMyStatuses, postMyStatus, sendMessage } from "@/app/actions/sabwa.actions";

type Audience = "everyone" | "except" | "only";
type StatusView = "my" | "friends";

const AUDIENCE_OPTIONS: { id: Audience; label: string; icon: typeof Eye }[] = [
  { id: "everyone", label: "Everyone", icon: Users },
  { id: "except", label: "Contacts except…", icon: EyeOff },
  { id: "only", label: "Only share with…", icon: Lock },
];

const TEXT_BG_COLOURS: { label: string; value: string }[] = [
  { label: "Slate", value: "#1f2937" },
  { label: "Stone", value: "#3f3f46" },
  { label: "Zinc", value: "#27272a" },
  { label: "Charcoal", value: "#18181b" },
  { label: "Graphite", value: "#374151" },
  { label: "Onyx", value: "#0f172a" },
];

interface PostedStatus {
  _id: string;
  ts: Date;
  kind: "text" | "media";
  body?: string;
  bgColour?: string;
  mediaUrl?: string;
  mediaName?: string;
  audience: Audience;
  viewers: { jid: string; name: string; ts: Date }[];
  reposters: { jid: string; name: string }[];
}

interface FriendStatusEntry {
  jid: string;
  name: string;
  postedAt: Date;
  preview?: string;
}

function timeAgo(ts: Date | string): string {
  const dateObj = typeof ts === 'string' ? new Date(ts) : ts;
  const diff = Date.now() - dateObj.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return dateObj.toLocaleDateString();
}

export default function SabWaStatusPage() {
  const toast = useZoruToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const { data: chats } = useChats(sessionId);

  // ── Posted (from DB) ─────────────────────────────────────────────
  const [posted, setPosted] = React.useState<PostedStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = React.useState(false);

  const fetchStatuses = React.useCallback(async () => {
    if (!sessionId) return;
    setLoadingStatuses(true);
    const res = await listMyStatuses(sessionId);
    if (res.ok && res.data) {
      setPosted(res.data);
    }
    setLoadingStatuses(false);
  }, [sessionId]);

  React.useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // ── Active view (segmented switcher) ───────────────────────────────
  const [view, setView] = React.useState<StatusView>("my");

  // ── Friends' statuses, sourced from `type === 'status'` chats ──────
  const friendStatuses: FriendStatusEntry[] = React.useMemo(() => {
    return (chats ?? [])
      .filter((c) => c.type === "status")
      .map((c) => ({
        jid: c.jid,
        name: c.name ?? c.jid,
        postedAt: c.lastMessage?.ts
          ? new Date(c.lastMessage.ts)
          : new Date(c.updatedAt),
        preview: c.lastMessage?.body,
      }))
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  }, [chats]);

  // ── Composer ───────────────────────────────────────────────────────
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerMode, setComposerMode] = React.useState<"text" | "media">(
    "text",
  );
  const [composerText, setComposerText] = React.useState("");
  const [composerBg, setComposerBg] = React.useState(TEXT_BG_COLOURS[0].value);
  const [composerMedia, setComposerMedia] = React.useState<SabFilePick | null>(
    null,
  );
  const [composerAudience, setComposerAudience] =
    React.useState<Audience>("everyone");
  const [isPosting, setIsPosting] = React.useState(false);

  const resetComposer = React.useCallback(() => {
    setComposerText("");
    setComposerBg(TEXT_BG_COLOURS[0].value);
    setComposerMedia(null);
    setComposerAudience("everyone");
    setComposerMode("text");
  }, []);

  const handlePost = React.useCallback(async () => {
    if (composerMode === "text" && !composerText.trim()) {
      toast.toast({ title: "Type something to post", variant: "destructive" });
      return;
    }
    if (composerMode === "media" && !composerMedia) {
      toast.toast({ title: "Pick media to post", variant: "destructive" });
      return;
    }
    
    setIsPosting(true);
    const data = {
      kind: composerMode,
      body: composerMode === "text" ? composerText : composerMedia?.name,
      bgColour: composerMode === "text" ? composerBg : undefined,
      mediaUrl: composerMode === "media" ? composerMedia?.url : undefined,
      mediaName: composerMode === "media" ? composerMedia?.name : undefined,
      audience: composerAudience,
    };
    
    const res = await postMyStatus(sessionId, data);
    if (res.ok && res.data) {
      setPosted((prev) => [res.data, ...prev]);
      toast.toast({
        title: "Status posted",
        description: "Your status has been updated.",
      });
      setComposerOpen(false);
      resetComposer();
    } else {
      toast.toast({
        title: "Failed to post status",
        description: res.error || "Unknown error",
        variant: "destructive",
      });
    }
    setIsPosting(false);
  }, [
    composerMode,
    composerText,
    composerMedia,
    composerBg,
    composerAudience,
    toast,
    resetComposer,
    sessionId
  ]);

  // ── Viewers List ───────────────────────────────────────────────────
  const [viewersDialogOpen, setViewersDialogOpen] = React.useState(false);
  const [activeStatusForViewers, setActiveStatusForViewers] = React.useState<PostedStatus | null>(null);

  const openViewers = React.useCallback((s: PostedStatus) => {
    setActiveStatusForViewers(s);
    setViewersDialogOpen(true);
  }, []);

  // ── Friends viewer ─────────────────────────────────────────────────
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);
  const viewerEntry =
    viewerIndex !== null ? friendStatuses[viewerIndex] ?? null : null;

  const [replyText, setReplyText] = React.useState("");
  const [isReplying, setIsReplying] = React.useState(false);

  const closeViewer = React.useCallback(() => {
    setViewerIndex(null);
    setReplyText("");
  }, []);
  const viewerPrev = React.useCallback(() => {
    setViewerIndex((i) => (i === null ? null : Math.max(0, i - 1)));
    setReplyText("");
  }, []);
  const viewerNext = React.useCallback(() => {
    setViewerIndex((i) =>
      i === null ? null : Math.min(friendStatuses.length - 1, i + 1),
    );
    setReplyText("");
  }, [friendStatuses.length]);

  const handleReply = React.useCallback(async () => {
    if (!replyText.trim() || !viewerEntry) return;
    setIsReplying(true);
    const res = await sendMessage({
      sessionId,
      jid: viewerEntry.jid,
      type: "text",
      body: replyText,
    });
    if (res.ok) {
      toast.toast({
        title: "Reply sent",
        description: `Sent to ${viewerEntry.name}`,
      });
      setReplyText("");
      closeViewer();
    } else {
      toast.toast({
        title: "Failed to send reply",
        description: res.error || "An error occurred",
        variant: "destructive",
      });
    }
    setIsReplying(false);
  }, [replyText, viewerEntry, sessionId, toast, closeViewer]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Status / Stories</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-[var(--zoru-radius)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)]"
        >
          <CircleDot className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
            Status / Stories
          </h1>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            Post text or media to your audience, and see what your contacts are
            sharing.
          </p>
        </div>
        <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
          <ZoruDialogTrigger asChild>
            <Button type="button">
              <Plus className="mr-2 h-4 w-4" /> Post new status
            </Button>
          </ZoruDialogTrigger>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>New status</ZoruDialogTitle>
              <ZoruDialogDescription>
                Pick a mode, set audience, and post.
              </ZoruDialogDescription>
            </ZoruDialogHeader>

            {/* Composer mode switcher — segmented buttons (no tab UI) */}
            <div
              role="group"
              aria-label="Composer mode"
              className="inline-flex w-full rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
            >
              <Button
                type="button"
                variant={composerMode === "text" ? "default" : "ghost"}
                size="sm"
                className="flex-1 rounded-[calc(var(--zoru-radius)-2px)]"
                aria-pressed={composerMode === "text"}
                onClick={() => setComposerMode("text")}
              >
                <TypeIcon className="mr-1.5 h-3.5 w-3.5" /> Text
              </Button>
              <Button
                type="button"
                variant={composerMode === "media" ? "default" : "ghost"}
                size="sm"
                className="flex-1 rounded-[calc(var(--zoru-radius)-2px)]"
                aria-pressed={composerMode === "media"}
                onClick={() => setComposerMode("media")}
              >
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Media
              </Button>
            </div>

            {composerMode === "text" ? (
              <div className="space-y-3 pt-4">
                <div
                  className="flex min-h-[160px] items-center justify-center rounded-[var(--zoru-radius)] p-6 text-center text-lg font-medium text-[var(--st-text-inverted)]"
                  style={{ backgroundColor: composerBg }}
                >
                  {composerText || "Type your status..."}
                </div>
                <Textarea
                  rows={3}
                  placeholder="Type your status..."
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  maxLength={700}
                />
                <div>
                  <Label className="text-xs font-medium">Background</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {TEXT_BG_COLOURS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setComposerBg(c.value)}
                        className="h-7 w-7 rounded-full border-2"
                        style={{
                          backgroundColor: c.value,
                          borderColor:
                            composerBg === c.value
                              ? "var(--zoru-ink)"
                              : "transparent",
                        }}
                        aria-label={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-4">
                {composerMedia ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-[var(--st-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={composerMedia.url}
                        alt={composerMedia.name}
                        className="block max-h-[260px] w-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                        {composerMedia.name}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setComposerMedia(null)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <SabFilePickerButton
                    accept="image"
                    onPick={(pick) => setComposerMedia(pick)}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Pick from SabFiles
                  </SabFilePickerButton>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-medium">Audience</Label>
              <Select
                value={composerAudience}
                onValueChange={(v) => setComposerAudience(v as Audience)}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {AUDIENCE_OPTIONS.map((o) => (
                    <ZoruSelectItem key={o.id} value={o.id}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <ZoruDialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setComposerOpen(false);
                  resetComposer();
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={isPosting} onClick={handlePost}>
                <Send className="mr-2 h-4 w-4" /> Post
              </Button>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </Dialog>
      </div>

      {/* View switcher — segmented buttons (no tab UI) */}
      <div
        role="group"
        aria-label="Status view"
        className="inline-flex rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
      >
        <Button
          type="button"
          variant={view === "my" ? "default" : "ghost"}
          size="sm"
          className="rounded-[calc(var(--zoru-radius)-2px)]"
          aria-pressed={view === "my"}
          onClick={() => setView("my")}
        >
          My status
        </Button>
        <Button
          type="button"
          variant={view === "friends" ? "default" : "ghost"}
          size="sm"
          className="rounded-[calc(var(--zoru-radius)-2px)]"
          aria-pressed={view === "friends"}
          onClick={() => setView("friends")}
        >
          Friends&apos; statuses
        </Button>
      </div>

      {/* My status */}
      {view === "my" ? (
        <div className="space-y-3">
          {loadingStatuses ? (
            <div className="py-10 text-center text-sm text-[var(--st-text-secondary)]">Loading statuses...</div>
          ) : posted.length === 0 ? (
            <Card className="border-dashed">
              <ZoruCardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <CircleDot className="h-7 w-7 text-[var(--st-text-secondary)]" />
                <h3 className="text-sm font-semibold text-[var(--st-text)]">
                  You haven&apos;t posted any status yet
                </h3>
                <p className="max-w-md text-[11.5px] text-[var(--st-text-secondary)]">
                  Hit &ldquo;Post new status&rdquo; to share text with a
                  coloured background or an image from your SabFiles library.
                </p>
              </ZoruCardContent>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {posted.map((s) => (
                <li key={s._id}>
                  <Card>
                    <ZoruCardContent className="space-y-3 p-3">
                      {s.kind === "text" ? (
                        <div
                          className="flex min-h-[120px] items-center justify-center rounded-[var(--zoru-radius)] p-4 text-center text-base font-medium text-[var(--st-text-inverted)]"
                          style={{ backgroundColor: s.bgColour }}
                        >
                          {s.body}
                        </div>
                      ) : s.mediaUrl ? (
                        <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-[var(--st-border)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.mediaUrl}
                            alt={s.mediaName ?? "Status media"}
                            className="block max-h-[200px] w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto p-1 px-2"
                          onClick={() => openViewers(s)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {s.viewers.length} views
                        </Button>
                        <Badge variant="ghost">
                          <Repeat2 className="mr-1 h-3 w-3" />
                          {s.reposters.length} reposters
                        </Badge>
                        <Badge variant="outline">
                          {
                            AUDIENCE_OPTIONS.find(
                              (a) => a.id === s.audience,
                            )?.label
                          }
                        </Badge>
                        <span className="ml-auto text-[var(--st-text-secondary)]">
                          {timeAgo(s.ts)}
                        </span>
                      </div>
                    </ZoruCardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Friends */
        <div className="space-y-3">
          {friendStatuses.length === 0 ? (
            <Card className="border-dashed">
              <ZoruCardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <Users className="h-7 w-7 text-[var(--st-text-secondary)]" />
                <h3 className="text-sm font-semibold text-[var(--st-text)]">
                  No friends&apos; statuses
                </h3>
                <p className="max-w-md text-[11.5px] text-[var(--st-text-secondary)]">
                  When your contacts post a status, you&apos;ll see them as
                  cards here. Tap one to open the swipeable viewer.
                </p>
              </ZoruCardContent>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {friendStatuses.map((f, i) => (
                <li key={f.jid}>
                  <button
                    type="button"
                    onClick={() => setViewerIndex(i)}
                    className="w-full text-left"
                  >
                    <Card className="transition hover:shadow-[var(--zoru-shadow-md)]">
                      <ZoruCardContent className="space-y-2 p-3">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-sm font-semibold text-[var(--st-text)]"
                          >
                            {f.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[var(--st-text)]">
                              {f.name}
                            </div>
                            <div className="text-[11.5px] text-[var(--st-text-secondary)]">
                              {timeAgo(f.postedAt)}
                            </div>
                          </div>
                        </div>
                        {f.preview && (
                          <p className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                            {f.preview}
                          </p>
                        )}
                      </ZoruCardContent>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Viewers Dialog */}
      <Dialog
        open={viewersDialogOpen}
        onOpenChange={(o) => {
          if (!o) setViewersDialogOpen(false);
        }}
      >
        <ZoruDialogContent className="max-w-sm">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Viewers</ZoruDialogTitle>
            <ZoruDialogDescription>
              People who have viewed this status.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="max-h-[300px] overflow-y-auto pt-4 space-y-3">
            {activeStatusForViewers?.viewers.length === 0 ? (
              <div className="py-4 text-center text-sm text-[var(--st-text-secondary)]">No viewers yet.</div>
            ) : (
              activeStatusForViewers?.viewers.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-xs font-semibold text-[var(--st-text)]"
                  >
                    {v.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--st-text)]">
                      {v.name}
                    </div>
                    <div className="text-[11.5px] text-[var(--st-text-secondary)]">
                      {timeAgo(v.ts)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ZoruDialogContent>
      </Dialog>

      {/* Friend status viewer */}
      <Dialog
        open={viewerEntry !== null}
        onOpenChange={(o) => {
          if (!o) closeViewer();
        }}
      >
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>{viewerEntry?.name ?? "Status"}</ZoruDialogTitle>
            <ZoruDialogDescription>
              {viewerEntry ? timeAgo(viewerEntry.postedAt) : ""}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="relative">
            <div className="flex min-h-[280px] items-center justify-center rounded-[var(--zoru-radius)] bg-[var(--st-bg-secondary)] p-6 text-center text-[13px] text-[var(--st-text)]">
              {viewerEntry?.preview ?? "No preview available."}
            </div>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={viewerPrev}
                disabled={viewerIndex === 0}
                aria-label="Previous status"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={viewerNext}
                disabled={
                  viewerIndex === null ||
                  viewerIndex >= friendStatuses.length - 1
                }
                aria-label="Next status"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Reply section */}
          <div className="pt-4 mt-2 border-t border-[var(--st-border)] flex gap-2">
            <Input 
              placeholder="Reply to status..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReply();
              }}
              className="flex-1"
            />
            <Button 
              type="button"
              disabled={isReplying || !replyText.trim()}
              onClick={handleReply}
              size="icon"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
