"use client";

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruEmptyState,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
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
  } from "lucide-react";

/**
 * /sabwa/status — Status / Stories.
 *
 * Two views (segmented buttons — no tab UI):
 *  - My status: list of your posted statuses with views + reposters.
 *    "Post new status" button opens a composer with two modes:
 *    text (background colour picker) or media (SabFilePickerButton).
 *    Privacy: everyone / contacts except / only share with.
 *  - Friends: card grid of contacts who posted recently, opens a
 *    swipeable viewer dialog with prev/next + tap-zone navigation.
 *
 * Data layer: until the engine ships status fetch/post endpoints,
 * we keep "My posted statuses" as in-page state (composer pushes to
 * an array). Friends' statuses are sourced from chats of
 * `type === 'status'` if any exist; otherwise we show an empty state.
 *
 * Rendered with ZoruUI primitives — no shadcn `/ui/*` imports.
 */

import * as React from "react";
import Link from "next/link";

import { SabFilePickerButton } from "@/components/sabfiles";
import type { SabFilePick } from "@/components/sabfiles";
import { useChats } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";

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
  id: string;
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

function timeAgo(ts: Date): string {
  const diff = Date.now() - ts.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return ts.toLocaleDateString();
}

export default function SabWaStatusPage() {
  const toast = useZoruToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const { data: chats } = useChats(sessionId);

  // ── Posted (in-memory) ─────────────────────────────────────────────
  const [posted, setPosted] = React.useState<PostedStatus[]>([]);

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

  const resetComposer = React.useCallback(() => {
    setComposerText("");
    setComposerBg(TEXT_BG_COLOURS[0].value);
    setComposerMedia(null);
    setComposerAudience("everyone");
    setComposerMode("text");
  }, []);

  const handlePost = React.useCallback(() => {
    if (composerMode === "text" && !composerText.trim()) {
      toast.toast({ title: "Type something to post", variant: "destructive" });
      return;
    }
    if (composerMode === "media" && !composerMedia) {
      toast.toast({ title: "Pick media to post", variant: "destructive" });
      return;
    }
    const entry: PostedStatus = {
      id: `status-${Date.now()}`,
      ts: new Date(),
      kind: composerMode,
      body: composerMode === "text" ? composerText : composerMedia?.name,
      bgColour: composerMode === "text" ? composerBg : undefined,
      mediaUrl: composerMode === "media" ? composerMedia?.url : undefined,
      mediaName: composerMode === "media" ? composerMedia?.name : undefined,
      audience: composerAudience,
      viewers: [],
      reposters: [],
    };
    setPosted((prev) => [entry, ...prev]);
    toast.toast({
      title: "Status posted",
      description: "Your status has been queued for delivery.",
    });
    setComposerOpen(false);
    resetComposer();
  }, [
    composerMode,
    composerText,
    composerMedia,
    composerBg,
    composerAudience,
    toast,
    resetComposer,
  ]);

  // ── Friends viewer ─────────────────────────────────────────────────
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);
  const viewerEntry =
    viewerIndex !== null ? friendStatuses[viewerIndex] ?? null : null;

  const closeViewer = React.useCallback(() => setViewerIndex(null), []);
  const viewerPrev = React.useCallback(() => {
    setViewerIndex((i) => (i === null ? null : Math.max(0, i - 1)));
  }, []);
  const viewerNext = React.useCallback(() => {
    setViewerIndex((i) =>
      i === null ? null : Math.min(friendStatuses.length - 1, i + 1),
    );
  }, [friendStatuses.length]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <ZoruEmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <ZoruButton size="md">Open accounts</ZoruButton>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3 text-zoru-ink"
        >
          <CircleDot className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
            Status / Stories
          </h1>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            Post text or media to your audience, and see what your contacts are
            sharing.
          </p>
        </div>
        <ZoruDialog open={composerOpen} onOpenChange={setComposerOpen}>
          <ZoruDialogTrigger asChild>
            <ZoruButton type="button">
              <Plus className="mr-2 h-4 w-4" /> Post new status
            </ZoruButton>
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
              className="inline-flex w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1"
            >
              <ZoruButton
                type="button"
                variant={composerMode === "text" ? "default" : "ghost"}
                size="sm"
                className="flex-1 rounded-[calc(var(--zoru-radius)-2px)]"
                aria-pressed={composerMode === "text"}
                onClick={() => setComposerMode("text")}
              >
                <TypeIcon className="mr-1.5 h-3.5 w-3.5" /> Text
              </ZoruButton>
              <ZoruButton
                type="button"
                variant={composerMode === "media" ? "default" : "ghost"}
                size="sm"
                className="flex-1 rounded-[calc(var(--zoru-radius)-2px)]"
                aria-pressed={composerMode === "media"}
                onClick={() => setComposerMode("media")}
              >
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Media
              </ZoruButton>
            </div>

            {composerMode === "text" ? (
              <div className="space-y-3 pt-4">
                <div
                  className="flex min-h-[160px] items-center justify-center rounded-[var(--zoru-radius)] p-6 text-center text-lg font-medium text-zoru-on-primary"
                  style={{ backgroundColor: composerBg }}
                >
                  {composerText || "Type your status..."}
                </div>
                <ZoruTextarea
                  rows={3}
                  placeholder="Type your status..."
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  maxLength={700}
                />
                <div>
                  <ZoruLabel className="text-xs font-medium">Background</ZoruLabel>
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
                    <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={composerMedia.url}
                        alt={composerMedia.name}
                        className="block max-h-[260px] w-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[11.5px] text-zoru-ink-muted">
                        {composerMedia.name}
                      </span>
                      <ZoruButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setComposerMedia(null)}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Remove
                      </ZoruButton>
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
              <ZoruLabel className="text-xs font-medium">Audience</ZoruLabel>
              <ZoruSelect
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
              </ZoruSelect>
            </div>

            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setComposerOpen(false);
                  resetComposer();
                }}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="button" onClick={handlePost}>
                <Send className="mr-2 h-4 w-4" /> Post
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </div>

      {/* View switcher — segmented buttons (no tab UI) */}
      <div
        role="group"
        aria-label="Status view"
        className="inline-flex rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1"
      >
        <ZoruButton
          type="button"
          variant={view === "my" ? "default" : "ghost"}
          size="sm"
          className="rounded-[calc(var(--zoru-radius)-2px)]"
          aria-pressed={view === "my"}
          onClick={() => setView("my")}
        >
          My status
        </ZoruButton>
        <ZoruButton
          type="button"
          variant={view === "friends" ? "default" : "ghost"}
          size="sm"
          className="rounded-[calc(var(--zoru-radius)-2px)]"
          aria-pressed={view === "friends"}
          onClick={() => setView("friends")}
        >
          Friends&apos; statuses
        </ZoruButton>
      </div>

      {/* My status */}
      {view === "my" ? (
        <div className="space-y-3">
          {posted.length === 0 ? (
            <ZoruCard className="border-dashed">
              <ZoruCardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <CircleDot className="h-7 w-7 text-zoru-ink-muted" />
                <h3 className="text-sm font-semibold text-zoru-ink">
                  You haven&apos;t posted any status yet
                </h3>
                <p className="max-w-md text-[11.5px] text-zoru-ink-muted">
                  Hit &ldquo;Post new status&rdquo; to share text with a
                  coloured background or an image from your SabFiles library.
                </p>
              </ZoruCardContent>
            </ZoruCard>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {posted.map((s) => (
                <li key={s.id}>
                  <ZoruCard>
                    <ZoruCardContent className="space-y-3 p-3">
                      {s.kind === "text" ? (
                        <div
                          className="flex min-h-[120px] items-center justify-center rounded-[var(--zoru-radius)] p-4 text-center text-base font-medium text-zoru-on-primary"
                          style={{ backgroundColor: s.bgColour }}
                        >
                          {s.body}
                        </div>
                      ) : s.mediaUrl ? (
                        <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.mediaUrl}
                            alt={s.mediaName ?? "Status media"}
                            className="block max-h-[200px] w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                        <ZoruBadge variant="ghost">
                          <Eye className="mr-1 h-3 w-3" />
                          {s.viewers.length} views
                        </ZoruBadge>
                        <ZoruBadge variant="ghost">
                          <Repeat2 className="mr-1 h-3 w-3" />
                          {s.reposters.length} reposters
                        </ZoruBadge>
                        <ZoruBadge variant="outline">
                          {
                            AUDIENCE_OPTIONS.find(
                              (a) => a.id === s.audience,
                            )?.label
                          }
                        </ZoruBadge>
                        <span className="ml-auto text-zoru-ink-muted">
                          {timeAgo(s.ts)}
                        </span>
                      </div>
                    </ZoruCardContent>
                  </ZoruCard>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Friends */
        <div className="space-y-3">
          {friendStatuses.length === 0 ? (
            <ZoruCard className="border-dashed">
              <ZoruCardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <Users className="h-7 w-7 text-zoru-ink-muted" />
                <h3 className="text-sm font-semibold text-zoru-ink">
                  No friends&apos; statuses
                </h3>
                <p className="max-w-md text-[11.5px] text-zoru-ink-muted">
                  When your contacts post a status, you&apos;ll see them as
                  cards here. Tap one to open the swipeable viewer.
                </p>
              </ZoruCardContent>
            </ZoruCard>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {friendStatuses.map((f, i) => (
                <li key={f.jid}>
                  <button
                    type="button"
                    onClick={() => setViewerIndex(i)}
                    className="w-full text-left"
                  >
                    <ZoruCard className="transition hover:shadow-[var(--zoru-shadow-md)]">
                      <ZoruCardContent className="space-y-2 p-3">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface text-sm font-semibold text-zoru-ink"
                          >
                            {f.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zoru-ink">
                              {f.name}
                            </div>
                            <div className="text-[11.5px] text-zoru-ink-muted">
                              {timeAgo(f.postedAt)}
                            </div>
                          </div>
                        </div>
                        {f.preview && (
                          <p className="truncate text-[11.5px] text-zoru-ink-muted">
                            {f.preview}
                          </p>
                        )}
                      </ZoruCardContent>
                    </ZoruCard>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Friend status viewer */}
      <ZoruDialog
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
            <div className="flex min-h-[280px] items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface p-6 text-center text-[13px] text-zoru-ink">
              {viewerEntry?.preview ?? "No preview available."}
            </div>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <ZoruButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={viewerPrev}
                disabled={viewerIndex === 0}
                aria-label="Previous status"
              >
                <ArrowLeft className="h-4 w-4" />
              </ZoruButton>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <ZoruButton
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
              </ZoruButton>
            </div>
          </div>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
