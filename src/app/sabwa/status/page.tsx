"use client";

/**
 * /sabwa/status — Status / Stories.
 *
 * Two tabs:
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
 */

import * as React from "react";
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
  Type as TypeIcon,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SabFilePickerButton } from "@/components/sabfiles";
import type { SabFilePick } from "@/components/sabfiles";
import { useToast } from "@/hooks/use-toast";
import { useChats } from "@/lib/sabwa/use-sabwa-data";

const PLACEHOLDER_SESSION_ID = "stub-primary";

type Audience = "everyone" | "except" | "only";

const AUDIENCE_OPTIONS: { id: Audience; label: string; icon: typeof Eye }[] = [
  { id: "everyone", label: "Everyone", icon: Users },
  { id: "except", label: "Contacts except…", icon: EyeOff },
  { id: "only", label: "Only share with…", icon: Lock },
];

const TEXT_BG_COLOURS: { label: string; value: string }[] = [
  { label: "Teal", value: "#0f766e" },
  { label: "Coral", value: "#ea580c" },
  { label: "Indigo", value: "#4338ca" },
  { label: "Forest", value: "#166534" },
  { label: "Crimson", value: "#be123c" },
  { label: "Slate", value: "#334155" },
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
  const { toast } = useToast();
  const sessionId = PLACEHOLDER_SESSION_ID;
  const { data: chats } = useChats(sessionId);

  // ── Posted (in-memory) ─────────────────────────────────────────────
  const [posted, setPosted] = React.useState<PostedStatus[]>([]);

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
      toast({ title: "Type something to post", variant: "destructive" });
      return;
    }
    if (composerMode === "media" && !composerMedia) {
      toast({ title: "Pick media to post", variant: "destructive" });
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
    toast({
      title: "Status posted",
      description:
        "Your status is queued. The engine bridge will broadcast it when live.",
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

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-xl bg-secondary p-3 text-secondary-foreground"
        >
          <CircleDot className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Status / Stories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post text or media to your audience, and see what your contacts are
            sharing.
          </p>
        </div>
        <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className="mr-2 h-4 w-4" /> Post new status
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New status</DialogTitle>
              <DialogDescription>
                Pick a mode, set audience, and post.
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={composerMode}
              onValueChange={(v) =>
                setComposerMode((v as "text" | "media") ?? "text")
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">
                  <TypeIcon className="mr-1.5 h-3.5 w-3.5" /> Text
                </TabsTrigger>
                <TabsTrigger value="media">
                  <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Media
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3 pt-4">
                <div
                  className="flex min-h-[160px] items-center justify-center rounded-md p-6 text-center text-lg font-medium text-white"
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
                              ? "var(--foreground)"
                              : "transparent",
                        }}
                        aria-label={c.label}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-3 pt-4">
                {composerMedia ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={composerMedia.url}
                        alt={composerMedia.name}
                        className="block max-h-[260px] w-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs text-muted-foreground">
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
              </TabsContent>
            </Tabs>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Audience</Label>
              <Select
                value={composerAudience}
                onValueChange={(v) => setComposerAudience(v as Audience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
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
              <Button type="button" onClick={handlePost}>
                <Send className="mr-2 h-4 w-4" /> Post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my">My status</TabsTrigger>
          <TabsTrigger value="friends">Friends&apos; statuses</TabsTrigger>
        </TabsList>

        {/* My status */}
        <TabsContent value="my" className="space-y-3 pt-4">
          {posted.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <CircleDot className="h-7 w-7 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  You haven&apos;t posted any status yet
                </h3>
                <p className="max-w-md text-xs text-muted-foreground">
                  Hit &ldquo;Post new status&rdquo; to share text with a
                  coloured background or an image from your SabFiles library.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {posted.map((s) => (
                <li key={s.id}>
                  <Card>
                    <CardContent className="space-y-3 p-3">
                      {s.kind === "text" ? (
                        <div
                          className="flex min-h-[120px] items-center justify-center rounded-md p-4 text-center text-base font-medium text-white"
                          style={{ backgroundColor: s.bgColour }}
                        >
                          {s.body}
                        </div>
                      ) : s.mediaUrl ? (
                        <div className="overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.mediaUrl}
                            alt={s.mediaName ?? "Status media"}
                            className="block max-h-[200px] w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">
                          <Eye className="mr-1 h-3 w-3" />
                          {s.viewers.length} views
                        </Badge>
                        <Badge variant="secondary">
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
                        <span className="ml-auto text-muted-foreground">
                          {timeAgo(s.ts)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Friends */}
        <TabsContent value="friends" className="space-y-3 pt-4">
          {friendStatuses.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <Users className="h-7 w-7 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  No friends&apos; statuses
                </h3>
                <p className="max-w-md text-xs text-muted-foreground">
                  When your contacts post a status, you&apos;ll see them as
                  cards here. Tap one to open the swipeable viewer.
                </p>
              </CardContent>
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
                    <Card className="transition hover:shadow-md">
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                          >
                            {f.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {f.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {timeAgo(f.postedAt)}
                            </div>
                          </div>
                        </div>
                        {f.preview && (
                          <p className="truncate text-xs text-muted-foreground">
                            {f.preview}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Friend status viewer */}
      <Dialog
        open={viewerEntry !== null}
        onOpenChange={(o) => {
          if (!o) closeViewer();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewerEntry?.name ?? "Status"}</DialogTitle>
            <DialogDescription>
              {viewerEntry ? timeAgo(viewerEntry.postedAt) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <div className="flex min-h-[280px] items-center justify-center rounded-md bg-muted p-6 text-center text-sm">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
