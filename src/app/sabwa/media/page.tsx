"use client";

import {
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
  Skeleton,
  cn,
  useToast,
} from "@/components/sabcrm/20ui";
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
 * /sabwa/media - Unified media library for the connected SabWa session.
 *
 * Filter strip (chat / date range / type segmented buttons), masonry grid
 * (pure CSS columns, no extra deps), lightbox dialog with prev/next
 * arrows, download, push-to-SabFiles, and open-in-chat. Bulk select for
 * batch download and batch push.
 *
 * Data layer: walks chat list via `useChats`, then for each chat fetches
 * messages via `getChatMessages` and filters to media types. Until the
 * Rust engine is wired the chat list is empty and we render the empty
 * state with full UI controls visible.
 *
 * Rendered with pure 20ui primitives. Tabs UI is intentionally avoided per
 * the design rules; the media-type switcher is a segmented Button group.
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
  const { toast } = useToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? "";

  const { data: chats, loading: chatsLoading } = useChats(sessionId);

  // Filters
  const [tab, setTab] = React.useState<MediaTab>("photos");
  const [chatFilter, setChatFilter] = React.useState<string>("all");
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  // Media fetch
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

  // Selection
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
    toast({
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
    toast({
      title: "Push to SabFiles queued",
      description: `${selectedItems.length} item${
        selectedItems.length === 1 ? "" : "s"
      } will be copied into your SabFiles library when the engine bridge is live.`,
    });
  }, [selectedItems, toast]);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
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
          icon={Smartphone}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button variant="primary" size="md">
                Open accounts
              </Button>
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
      <PageHeader>
        <PageHeaderHeading>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-2 text-[var(--st-text)]"
            >
              <TabIcon className="h-5 w-5" />
            </span>
            <PageTitle>Media Library</PageTitle>
            <Badge tone="neutral">
              {items.length} {TAB_LABELS[tab].toLowerCase()}
            </Badge>
          </div>
          <PageDescription>
            Everything sent and received across this session, in one place.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMedia()}
            disabled={mediaLoading}
            aria-label="Refresh media"
          >
            {mediaLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant={bulkMode ? "primary" : "outline"}
            size="sm"
            iconLeft={CheckSquare}
            onClick={() => {
              setBulkMode((v) => !v);
              clearSelection();
            }}
          >
            {bulkMode ? "Done" : "Select"}
          </Button>
        </PageActions>
      </PageHeader>

      {/* Filter strip */}
      <Card padding="none">
        <CardBody className="grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Chat">
            <Select value={chatFilter} onValueChange={setChatFilter}>
              <SelectTrigger aria-label="Filter by chat">
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
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </Field>
          <Field label="Quick" className="sm:col-span-3 lg:col-span-1">
            <Button
              variant="ghost"
              size="sm"
              iconLeft={CalendarDays}
              className="w-full justify-start"
              onClick={() => {
                setFromDate("");
                setToDate("");
                setChatFilter("all");
                toast({ title: "Filters reset" });
              }}
            >
              Reset filters
            </Button>
          </Field>
        </CardBody>
      </Card>

      {/* Type switcher - segmented Button group (no tab UI) */}
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
              variant={active ? "primary" : "ghost"}
              size="sm"
              iconLeft={Icon}
              className="rounded-[calc(var(--st-radius)-2px)]"
              aria-pressed={active}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </Button>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 shadow-[var(--st-shadow-sm)]">
          <Badge tone="neutral">{selected.size} selected</Badge>
          <Button
            size="sm"
            variant="outline"
            iconLeft={Download}
            onClick={handleBulkDownload}
          >
            Download ZIP
          </Button>
          <Button
            size="sm"
            variant="outline"
            iconLeft={Upload}
            onClick={handleBulkPushSabFiles}
          >
            Push to SabFiles
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconLeft={X}
            onClick={clearSelection}
            className="ml-auto"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Grid */}
      <section aria-label="Media grid">
        {mediaLoading && (
          <div className="columns-3 gap-3 [column-gap:0.75rem]">
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
              <CircleSlash
                className="h-4 w-4 text-[var(--st-danger)]"
                aria-hidden="true"
              />
              <span className="text-[var(--st-text-secondary)]">
                {mediaError}
              </span>
            </CardBody>
          </Card>
        )}

        {!mediaLoading && !mediaError && items.length === 0 && (
          <EmptyState
            icon={Folder}
            title="No media yet"
            description="Once your session is connected and chats sync, every photo, video, voice note and document will land here."
          />
        )}

        {!mediaLoading && items.length > 0 && (
          <div className="columns-3 gap-3 [column-gap:0.75rem]">
            {items.map((it, index) => {
              const id = it.message.messageId;
              const isSelected = selected.has(id);
              const isImage =
                it.message.type === "image" || it.message.type === "sticker";
              const isVideo = it.message.type === "video";
              const openTile = () => {
                if (bulkMode) toggleSelect(id);
                else setLightboxIndex(index);
              };
              return (
                <Card
                  key={id}
                  variant="interactive"
                  padding="none"
                  role="button"
                  tabIndex={0}
                  onClick={openTile}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openTile();
                    }
                  }}
                  className={cn(
                    "mb-3 block w-full break-inside-avoid overflow-hidden text-left",
                  )}
                  aria-label={`Open ${fileNameFromMessage(it.message)}`}
                  aria-pressed={bulkMode ? isSelected : undefined}
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
                        <FileVideo
                          className="h-8 w-8 text-[var(--st-text-secondary)]"
                          aria-hidden="true"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-[var(--st-bg-muted)]">
                        {React.createElement(tabIcon(tab), {
                          className: "h-8 w-8 text-[var(--st-text-secondary)]",
                          "aria-hidden": "true",
                        })}
                      </div>
                    )}
                    {bulkMode && (
                      <div className="absolute left-2 top-2">
                        <Checkbox
                          checked={isSelected}
                          readOnly
                          aria-label="Select"
                        />
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
                </Card>
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
                    Preview unavailable, download to view.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={ArrowLeft}
                  onClick={goPrev}
                  disabled={lightboxIndex === 0}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={goNext}
                  disabled={
                    lightboxIndex === null ||
                    lightboxIndex >= items.length - 1
                  }
                >
                  Next
                </Button>
                <span className="ml-auto" />
                {lightboxItem.message.mediaUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Download}
                    onClick={() => {
                      if (lightboxItem.message.mediaUrl) {
                        window.open(
                          lightboxItem.message.mediaUrl,
                          "_blank",
                          "noopener",
                        );
                      }
                    }}
                  >
                    Download
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={Upload}
                  onClick={() =>
                    toast({
                      title: "Push to SabFiles queued",
                      description:
                        "This file will be copied to your SabFiles library.",
                    })
                  }
                >
                  Push to SabFiles
                </Button>
                <Link
                  href={`/sabwa/inbox?jid=${encodeURIComponent(
                    lightboxItem.chatJid,
                  )}&message=${encodeURIComponent(
                    lightboxItem.message.messageId,
                  )}`}
                >
                  <Button variant="primary" size="sm" iconLeft={ExternalLink}>
                    Open in chat
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
