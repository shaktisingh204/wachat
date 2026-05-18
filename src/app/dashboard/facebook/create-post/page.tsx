"use client";

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
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
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDatePicker,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSeparator,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import {
  CalendarClock,
  Image as ImageIcon,
  Loader2,
  Send,
  Upload,
  Video,
  X,
  } from "lucide-react";

import {
  getPageDetails,
  handleCreateFacebookPost,
  } from "@/app/actions/facebook.actions";
import type { FacebookPageDetails } from "@/lib/definitions";
import { SabFilePickerButton } from "@/components/sabfiles";

/**
 * /dashboard/facebook/create-post — Composer, ZoruUI rebuild.
 *
 * Two-pane layout:
 *  - Left  : multi-section ZoruCard form (page identity, message, media,
 *             scheduling). Files now flow through SabFiles first, so the
 *             form submits a `mediaUrl` instead of a binary `mediaFile`.
 *             Hidden fields: projectId, postType, message, mediaUrl,
 *             isScheduled, scheduledDate, scheduledTime.
 *  - Right : elevated preview pane mimicking the published Facebook card.
 *
 * Server action: `handleCreateFacebookPost` (unchanged).
 */

import * as React from "react";

import { NoProjectState } from "../_components/no-project-state";

const initialState: { message?: string; error?: string } = {};

type PostType = "text" | "image" | "video";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending || disabled}>
      {pending ? <Loader2 className="animate-spin" /> : <Send />}
      Publish
    </ZoruButton>
  );
}

export default function CreateFacebookPostPage() {
  const [state, formAction] = useActionState(
    handleCreateFacebookPost,
    initialState,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdReady, setProjectIdReady] = useState(false);
  const [pageDetails, setPageDetails] = useState<FacebookPageDetails | null>(
    null,
  );

  // Form state — media now flows through SabFiles, so the form holds a URL
  // and a display name instead of a binary File.
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaName, setMediaName] = useState<string>("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [postType, setPostType] = useState<PostType>("text");

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("");

  useEffect(() => {
    document.title = "Create post · Meta Suite · SabNode";
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    setProjectId(stored);
    setProjectIdReady(true);
    if (stored) {
      getPageDetails(stored).then((result) => {
        if (result.page) setPageDetails(result.page);
      });
    }
  }, []);

  useEffect(() => {
    if (state.message) {
      toast({ title: "Post published", description: state.message });
      formRef.current?.reset();
      setMessage("");
      setMediaUrl("");
      setMediaName("");
      setMediaPreview(null);
      setPostType("text");
      setIsScheduled(false);
      setScheduledDate(undefined);
      setScheduledTime("");
    }
    if (state.error) {
      toast({
        title: "Could not publish",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const handlePickedMedia = (pick: {
    url: string;
    name: string;
    mime?: string;
  }) => {
    setMediaUrl(pick.url);
    setMediaName(pick.name);
    if (pick.mime?.startsWith("image/")) {
      setPostType("image");
    } else if (pick.mime?.startsWith("video/")) {
      setPostType("video");
    } else {
      // Fall back to extension sniff if MIME is missing.
      const lower = pick.name.toLowerCase();
      if (/\.(mp4|mov|webm|m4v)$/.test(lower)) setPostType("video");
      else setPostType("image");
    }
    setMediaPreview(pick.url);
  };

  const clearMedia = () => {
    setMediaUrl("");
    setMediaName("");
    setMediaPreview(null);
    setPostType("text");
  };

  const isPostDisabled = message.trim() === "" && !mediaUrl;

  const previewTimestamp = useMemo(() => {
    if (isScheduled && scheduledDate) {
      const datePart = format(scheduledDate, "PPP");
      return scheduledTime ? `${datePart} at ${scheduledTime}` : datePart;
    }
    return "Just now";
  }, [isScheduled, scheduledDate, scheduledTime]);

  if (!projectIdReady) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-10">
        <p className="text-sm text-zoru-ink-muted">Loading composer…</p>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <NoProjectState />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Create post</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader bordered={false} className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite</ZoruPageEyebrow>
          <ZoruPageTitle>Create post</ZoruPageTitle>
          <ZoruPageDescription>
            Compose a new post for your connected Facebook Page. Add media,
            schedule for later, or publish immediately.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/facebook/posts">
              <X /> Cancel
            </Link>
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <form action={formAction} ref={formRef} className="mt-6">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="postType" value={postType} />
        {isScheduled && (
          <>
            <input type="hidden" name="isScheduled" value="on" />
            <input
              type="hidden"
              name="scheduledDate"
              value={scheduledDate?.toISOString().split("T")[0] ?? ""}
            />
          </>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
          {/* ── Composer ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            {/* Identity */}
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Posting as</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="flex items-center gap-3">
                  <ZoruAvatar>
                    {pageDetails?.picture?.data.url && (
                      <ZoruAvatarImage
                        src={pageDetails.picture.data.url}
                        alt={pageDetails.name}
                      />
                    )}
                    <ZoruAvatarFallback>
                      {pageDetails?.name?.charAt(0) ?? "P"}
                    </ZoruAvatarFallback>
                  </ZoruAvatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zoru-ink">
                      {pageDetails?.name ?? "Connected Page"}
                    </span>
                    <span className="text-[12px] text-zoru-ink-muted">
                      Public post · Facebook Page
                    </span>
                  </div>
                </div>
              </ZoruCardContent>
            </ZoruCard>

            {/* Message */}
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Message</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="flex flex-col gap-2">
                  <ZoruLabel htmlFor="message" className="sr-only">
                    Post message
                  </ZoruLabel>
                  <ZoruTextarea
                    id="message"
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What do you want to talk about?"
                    rows={6}
                    className="min-h-32 resize-y"
                  />
                  <p className="text-[11px] text-zoru-ink-subtle">
                    {message.length} characters
                  </p>
                </div>
              </ZoruCardContent>
            </ZoruCard>

            {/* Media */}
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Media</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="flex flex-col gap-4">
                {/* The server action expects `mediaUrl` — a public URL that
                    Meta can pull. Files now go to SabFiles first, then we
                    pass the resulting URL down here. */}
                <input type="hidden" name="mediaUrl" value={mediaUrl} />
                {mediaPreview ? (
                  <div className="relative overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface-2">
                    {postType === "image" ? (
                      <Image
                        src={mediaPreview}
                        width={760}
                        height={420}
                        alt="Post media preview"
                        className="h-auto w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        className="w-full"
                      />
                    )}
                    <ZoruButton
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="absolute right-2 top-2"
                      aria-label="Remove media"
                      onClick={clearMedia}
                    >
                      <X />
                    </ZoruButton>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-bg p-8 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                      <Upload className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium text-zoru-ink">
                      Attach an image or video from SabFiles
                    </span>
                    <span className="text-xs text-zoru-ink-muted">
                      JPG, PNG, MP4 or MOV — pick from your library or upload
                      a new file.
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <SabFilePickerButton
                    accept="image"
                    onPick={handlePickedMedia}
                  >
                    <ImageIcon /> Add image
                  </SabFilePickerButton>
                  <SabFilePickerButton
                    accept="video"
                    onPick={handlePickedMedia}
                  >
                    <Video /> Add video
                  </SabFilePickerButton>
                  {mediaName && (
                    <span className="ml-2 truncate text-[12px] text-zoru-ink-muted">
                      {mediaName}
                    </span>
                  )}
                </div>
              </ZoruCardContent>
            </ZoruCard>

            {/* Scheduling */}
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Schedule</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface px-4 py-3">
                  <div className="flex flex-col">
                    <ZoruLabel
                      htmlFor="isScheduledSwitch"
                      className="font-semibold"
                    >
                      Schedule this post
                    </ZoruLabel>
                    <span className="text-[12px] text-zoru-ink-muted">
                      Publish later at a specific date and time.
                    </span>
                  </div>
                  <ZoruSwitch
                    id="isScheduledSwitch"
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <>
                    <ZoruSeparator />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="scheduledDate">Date</ZoruLabel>
                        <ZoruDatePicker
                          value={scheduledDate}
                          onChange={setScheduledDate}
                          placeholder="Pick a date"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <ZoruLabel htmlFor="scheduledTime">Time</ZoruLabel>
                        <ZoruInput
                          id="scheduledTime"
                          name="scheduledTime"
                          type="time"
                          required
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </ZoruCardContent>
            </ZoruCard>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg px-4 py-3">
              <p className="text-[12px] text-zoru-ink-muted">
                {isPostDisabled
                  ? "Add a message or attach media to enable publishing."
                  : isScheduled
                  ? "This post will be queued for the date and time above."
                  : "This post will be published immediately."}
              </p>
              <div className="flex items-center gap-2">
                <ZoruButton type="button" variant="outline" size="sm" asChild>
                  <Link href="/dashboard/facebook/posts">Cancel</Link>
                </ZoruButton>
                <SubmitButton disabled={isPostDisabled} />
              </div>
            </div>
          </div>

          {/* ── Preview pane ─────────────────────────────────────── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ZoruCard variant="elevated">
              <ZoruCardHeader className="flex-row items-center justify-between">
                <ZoruCardTitle>Preview</ZoruCardTitle>
                <ZoruBadge variant="ghost">
                  {postType === "video"
                    ? "Video"
                    : postType === "image"
                    ? "Photo"
                    : "Text"}
                </ZoruBadge>
              </ZoruCardHeader>
              <ZoruCardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <ZoruAvatar>
                    {pageDetails?.picture?.data.url && (
                      <ZoruAvatarImage
                        src={pageDetails.picture.data.url}
                        alt={pageDetails.name}
                      />
                    )}
                    <ZoruAvatarFallback>
                      {pageDetails?.name?.charAt(0) ?? "P"}
                    </ZoruAvatarFallback>
                  </ZoruAvatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zoru-ink">
                      {pageDetails?.name ?? "Connected Page"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-zoru-ink-muted">
                      <CalendarClock className="h-3 w-3" />
                      {previewTimestamp}
                    </span>
                  </div>
                </div>

                {message ? (
                  <p className="whitespace-pre-wrap text-sm text-zoru-ink">
                    {message}
                  </p>
                ) : (
                  <p className="text-sm italic text-zoru-ink-subtle">
                    Your message will appear here.
                  </p>
                )}

                {mediaPreview && (
                  <div className="overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface-2">
                    {postType === "image" ? (
                      <Image
                        src={mediaPreview}
                        width={420}
                        height={236}
                        alt="Preview media"
                        className="h-auto w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        className="w-full"
                        muted
                        loop
                        playsInline
                      />
                    )}
                  </div>
                )}
              </ZoruCardContent>
            </ZoruCard>
          </div>
        </div>
      </form>
    </div>
  );
}
