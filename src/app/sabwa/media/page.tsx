"use client";

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, cn, useToast } from '@/components/sabcrm/20ui';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  CircleSlash,
  Download,
  ExternalLink,
  FileAudio,
  FileText,
  FileVideo,
  Folder,
  Image as ImageIcon,
  Loader2,
  Mic,
  RefreshCw,
  Smartphone,
  Upload,
  X,
  } from "lucide-react";

/**
 * /sabwa/media — Unified media library for the connected SabWa session.
 *
 * Filter strip (chat / date range / type segmented buttons), masonry grid
 * (pure CSS columns — no extra deps), lightbox dialog with prev/next
 * arrows, download, push-to-SabFiles, and open-in-chat. Bulk select for
 * batch download and batch push.
 *
 * Data layer: walks chat list via `useChats`, then for each chat fetches
 * messages via `getChatMessages` and filters to media types. Until the
 * Rust engine is wired the chat list is empty and we render the empty
 * state with full UI controls visible.
 *
 * Rendered with ZoruUI primitives — no shadcn `/ui/*` imports. Tabs UI
 * is intentionally avoided per the ZoruUI design rules; the media-type
 * switcher is a segmented Button group.
 */

import * as React from "react";
import Link from "next/link";

import { getChatMessages } from "@/app/actions/sabwa.actions";
import { useChats } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import type { SabwaMessage, SabwaMessageType } from "@/lib/sabwa/types";

type MediaTab = "photos" | "videos" | "audio" | "docs" | "voice";

const MEDIA_TYPE_MAP: Record<MediaTab, SabwaMessageType[]> = {
  photos: ["image", "sticker"],
  videos: ["video"],
  audio: ["audio"],
  docs: ["document"],
  voice: ["voice"],
};

const TAB_LABELS: Record<MediaTab, string> = {
  photos: "Photos",
  videos: "Videos",
  audio: "Audio",
  docs: "Docs",
  voice: "Voice notes",
};

interface MediaItem {
  message: SabwaMessage;
  chatJid: string;
  chatName?: string;
}

function tabIcon(tab: MediaTab) {
  switch (tab) {
    case "videos":
      return FileVideo;
    case "audio":
      return FileAudio;
    case "docs":
      return FileText;
    case "voice":
      return Mic;
    case "photos":
    default:
      return ImageIcon;
  }
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function fileNameFromMessage(m: SabwaMessage): string {
  if (m.caption) return m.caption;
  const ext = m.mediaMime?.split("/")?.[1] ?? "bin";
  return `${m.messageId.slice(0, 12)}.${ext}`;
}

function formatTs(ts?: Date | string): string {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function SabWaMediaPage() {
  const toast = useToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';

  const { data: chats, loading: chatsLoading } = useChats(sessionId);

  // ── Filters ────────────────────────────────────────────────────────
  const [tab, setTab] = React.useState<MediaTab>("photos");
  const [chatFilter, setChatFilter] = React.useState<string>("all");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  // ── Media fetch ────────────────────────────────────────────────────
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = React.useState(false);
  const [mediaError, setMediaError] = React.useState<string | null>(null);

  const loadMedia = React.useCallback(async () => {
    if (!sessionId || !chats) return;
    setMediaLoading(true);
    setMediaError(null);
    try {
      const targetChats =
        chatFilter === "all"
          ? chats.slice(0, 25) // bound the scan to avoid spamming the engine
          : chats.filter((c) => c.jid === chatFilter);

      const allowedTypes = new Set(MEDIA_TYPE_MAP[tab]);
      const fromTs = fromDate ? new Date(fromDate).getTime() : 0;
      const toTs = toDate
        ? new Date(toDate).getTime() + 86_400_000
        : Number.POSITIVE_INFINITY;

      const collected: MediaItem[] = [];
      for (const c of targetChats) {
        try {
          const res = await getChatMessages(sessionId, c.jid, undefined);
          if (res.ok) {
            for (const m of res.messages ?? []) {
              if (!allowedTypes.has(m.type)) continue;
              const mTs = new Date(m.ts).getTime();
              if (mTs < fromTs || mTs > toTs) continue;
              collected.push({
                message: m,
                chatJid: c.jid,
                chatName: c.name,
              });
            }
          }
        } catch {
          // skip chat on failure
        }
      }
      collected.sort(
        (a, b) =>
          new Date(b.message.ts).getTime() - new Date(a.message.ts).getTime(),
      );
      setItems(collected);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : String(err));
    } finally {
      setMediaLoading(false);
    }
  }, [sessionId, chats, tab, chatFilter, fromDate, toDate]);

  React.useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  // ── Selection ──────────────────────────────────────────────────────
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [bulkMode, setBulkMode] = React.useState(false);

  const toggleSelect = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  const selectedItems = React.useMemo(
    () => items.filter((it) => selected.has(it.message.messageId)),
    [items, selected],
  );

  const handleBulkDownload = React.useCallback(() => {
    if (selectedItems.length === 0) return;
    toast.toast({
      title: "Preparing archive",
      description: `Bundling ${selectedItems.length} item${
        selectedItems.length === 1 ? "" : "s"
      } as a ZIP.`,
    });
    // Real ZIP build would happen in a server action / worker.
    for (const it of selectedItems) {
      if (it.message.mediaUrl) {
        window.open(it.message.mediaUrl, "_blank", "noopener");
      }
    }
  }, [selectedItems, toast]);

  const handleBulkPushSabFiles = React.useCallback(() => {
    if (selectedItems.length === 0) return;
    toast.toast({
      title: "Push to SabFiles queued",
      description: `${selectedItems.length} item${
        selectedItems.length === 1 ? "" : "s"
      } will be copied into your SabFiles library when the engine bridge is live.`,
    });
  }, [selectedItems, toast]);

  // ── Lightbox ───────────────────────────────────────────────────────
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(
    null,
  );
  const closeLightbox = React.useCallback(() => setLightboxIndex(null), []);
  const goPrev = React.useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1)));
  }, []);
  const goNext = React.useCallback(() => {
    setLightboxIndex((i) =>
      i === null ? null : Math.min(items.length - 1, i + 1),
    );
  }, [items.length]);
  const lightboxItem =
    lightboxIndex !== null ? items[lightboxIndex] ?? null : null;

  const TabIcon = tabIcon(tab);

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
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Media library</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)]"
        >
          <TabIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
              Media Library
            </h1>
            <Badge variant="ghost">
              {items.length} {TAB_LABELS[tab].toLowerCase()}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            Everything sent and received across this session, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMedia()}
            disabled={mediaLoading}
          >
            {mediaLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant={bulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setBulkMode((v) => !v);
              clearSelection();
            }}
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            {bulkMode ? "Done" : "Select"}
          </Button>
        </div>
      </div>

      {/* Filter strip */}
      <Card>
        <CardBody className="grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Chat</Label>
            <Select value={chatFilter} onValueChange={setChatFilter}>
              <SelectTrigger>
                <SelectValue
                  placeholder={chatsLoading ? "Loading..." : "All chats"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chats</SelectItem>
                {(chats ?? []).map((c) => (
                  <SelectItem key={c.jid} value={c.jid}>
                    {c.name ?? c.jid}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium" htmlFor="from-date">
              From
            </Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium" htmlFor="to-date">
              To
            </Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-3 lg:col-span-1">
            <Label className="text-xs font-medium">Quick</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setChatFilter("all");
                toast.toast({ title: "Filters reset" });
              }}
            >
              <CalendarDays className="mr-2 h-3.5 w-3.5" /> Reset filters
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Type switcher — segmented Button group (no tab UI) */}
      <div
        role="group"
        aria-label="Media type"
        className="inline-flex flex-wrap gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
      >
        {(Object.keys(MEDIA_TYPE_MAP) as MediaTab[]).map((t) => {
          const Icon = tabIcon(t);
          const active = tab === t;
          return (
            <Button
              key={t}
              type="button"
              variant={active ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 rounded-[calc(var(--st-radius)-2px)]"
              aria-pressed={active}
              onClick={() => setTab(t)}
            >
              <Icon className="h-3.5 w-3.5" />
              {TAB_LABELS[t]}
            </Button>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]/95 px-3 py-2 shadow-[var(--st-shadow-sm)] backdrop-blur">
          <Badge variant="ghost">{selected.size} selected</Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleBulkDownload}
          >
            <Download className="mr-2 h-4 w-4" /> Download ZIP
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleBulkPushSabFiles}
          >
            <Upload className="mr-2 h-4 w-4" /> Push to SabFiles
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            className="ml-auto"
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        </div>
      )}

      {/* Grid */}
      <section aria-label="Media grid">
        {mediaLoading && (
          <div
            className="gap-3"
            style={{ columnCount: 3, columnGap: "0.75rem" }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="mb-3 break-inside-avoid">
                <Skeleton className="h-40 w-full rounded-[var(--st-radius)]" />
              </div>
            ))}
          </div>
        )}

        {!mediaLoading && mediaError && (
          <Card>
            <CardBody className="flex items-start gap-2 p-4 text-sm">
              <CircleSlash className="h-4 w-4 text-[var(--st-danger)]" />
              <span className="text-[var(--st-text-secondary)]">{mediaError}</span>
            </CardBody>
          </Card>
        )}

        {!mediaLoading && !mediaError && items.length === 0 && (
          <Card className="border-dashed">
            <CardBody className="flex flex-col items-center gap-2 p-10 text-center">
              <Folder className="h-7 w-7 text-[var(--st-text-secondary)]" />
              <h3 className="text-sm font-semibold text-[var(--st-text)]">No media yet</h3>
              <p className="max-w-sm text-[11.5px] text-[var(--st-text-secondary)]">
                Once your session is connected and chats sync, every photo,
                video, voice note and document will land here.
              </p>
            </CardBody>
          </Card>
        )}

        {!mediaLoading && items.length > 0 && (
          <div
            className="gap-3"
            style={{
              columnCount: 3,
              columnGap: "0.75rem",
            }}
          >
            {items.map((it, index) => {
              const id = it.message.messageId;
              const isSelected = selected.has(id);
              const isImage = it.message.type === "image" || it.message.type === "sticker";
              const isVideo = it.message.type === "video";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (bulkMode) toggleSelect(id);
                    else setLightboxIndex(index);
                  }}
                  className={cn(
                    "mb-3 block w-full break-inside-avoid overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] text-left transition hover:shadow-[var(--st-shadow-md)]",
                  )}
                  aria-label={`Open ${fileNameFromMessage(it.message)}`}
                >
                  <div className="relative bg-[var(--st-bg-secondary)]">
                    {isImage && it.message.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.message.mediaUrl}
                        alt={fileNameFromMessage(it.message)}
                        className="block h-auto w-full"
                        loading="lazy"
                      />
                    ) : isVideo ? (
                      <div className="flex aspect-video items-center justify-center bg-[var(--st-bg-muted)]">
                        <FileVideo className="h-8 w-8 text-[var(--st-text-secondary)]" />
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-[var(--st-bg-muted)]">
                        {React.createElement(tabIcon(tab), {
                          className: "h-8 w-8 text-[var(--st-text-secondary)]",
                        })}
                      </div>
                    )}
                    {bulkMode && (
                      <div className="absolute left-2 top-2">
                        <Checkbox checked={isSelected} aria-label="Select" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2 text-[11.5px]">
                    <div className="truncate font-medium text-[var(--st-text)]">
                      {fileNameFromMessage(it.message)}
                    </div>
                    <div className="truncate text-[var(--st-text-secondary)]">
                      {it.chatName ?? it.chatJid}
                    </div>
                    <div className="text-[var(--st-text-secondary)]">
                      {formatTs(it.message.ts)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Lightbox dialog */}
      <Dialog
        open={lightboxItem !== null}
        onOpenChange={(o) => {
          if (!o) closeLightbox();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">
              {lightboxItem
                ? fileNameFromMessage(lightboxItem.message)
                : "Media"}
            </DialogTitle>
            <DialogDescription className="truncate">
              {lightboxItem?.chatName ?? lightboxItem?.chatJid}{" "}
              {lightboxItem ? `· ${formatTs(lightboxItem.message.ts)}` : ""}{" "}
              {lightboxItem?.message.mediaSize
                ? `· ${formatBytes(lightboxItem.message.mediaSize)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {lightboxItem && (
            <div className="space-y-3">
              <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                {(lightboxItem.message.type === "image" ||
                  lightboxItem.message.type === "sticker") &&
                lightboxItem.message.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightboxItem.message.mediaUrl}
                    alt={fileNameFromMessage(lightboxItem.message)}
                    className="max-h-[60vh] w-auto"
                  />
                ) : lightboxItem.message.type === "video" &&
                  lightboxItem.message.mediaUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={lightboxItem.message.mediaUrl}
                    controls
                    className="max-h-[60vh] w-full"
                  />
                ) : lightboxItem.message.type === "audio" ||
                  lightboxItem.message.type === "voice" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio
                    src={lightboxItem.message.mediaUrl}
                    controls
                    className="w-full"
                  />
                ) : (
                  <div className="p-8 text-center text-[13px] text-[var(--st-text-secondary)]">
                    Preview unavailable — download to view.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={lightboxIndex === 0}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={
                    lightboxIndex === null ||
                    lightboxIndex >= items.length - 1
                  }
                >
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <span className="ml-auto" />
                {lightboxItem.message.mediaUrl && (
                  <Button asChild type="button" variant="outline" size="sm">
                    <a
                      href={lightboxItem.message.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download className="mr-1 h-4 w-4" /> Download
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast.toast({
                      title: "Push to SabFiles queued",
                      description:
                        "This file will be copied to your SabFiles library.",
                    })
                  }
                >
                  <Upload className="mr-1 h-4 w-4" /> Push to SabFiles
                </Button>
                <Button asChild type="button" size="sm">
                  <Link
                    href={`/sabwa/inbox?jid=${encodeURIComponent(
                      lightboxItem.chatJid,
                    )}&message=${encodeURIComponent(
                      lightboxItem.message.messageId,
                    )}`}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" /> Open in chat
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
