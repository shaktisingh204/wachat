"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Facebook,
  Globe,
  Hash,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Share2,
  Sparkles,
  ThumbsUp,
  Wand2,
} from "lucide-react";

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
  EmptyState,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  Textarea,
  cn,
  useToast,
} from "@/components/sabcrm/20ui";

import { useProject } from "@/context/project-context";
import {
  TONES,
  GOALS,
  type PostTone,
  type PostGoal,
} from "@/lib/meta/ai/prompts";
import {
  suggestHashtags,
  suggestPostIdeas,
  rewriteCaption,
  type PostIdea,
} from "@/app/actions/facebook-ai.actions";
import type { RewriteMode } from "@/lib/meta/ai/prompts";
import { FacebookGlyph } from "../_components/icons";

/* ------------------------------------------------------------------ chips -- */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] transition-colors",
        active
          ? "border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]"
          : "border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border px-2.5 py-1 text-[12px] transition-colors",
        active
          ? "border-[var(--st-accent)] bg-[var(--st-accent-subtle,rgba(43,110,242,0.1))] text-[var(--st-accent)]"
          : "border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]",
      )}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border",
          active
            ? "border-[var(--st-accent)] bg-[var(--st-accent)] text-white"
            : "border-[var(--st-border-strong)]",
        )}
      >
        {active ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
      </span>
      {children}
    </button>
  );
}

const REWRITES: { mode: RewriteMode; label: string }[] = [
  { mode: "shorten", label: "Shorten" },
  { mode: "punchier", label: "Punchier" },
  { mode: "professional", label: "Professional" },
  { mode: "casual", label: "Casual" },
  { mode: "fix", label: "Fix grammar" },
];

/* ------------------------------------------------------------------- page -- */

export default function MetaStudioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeProject, activeProjectName } = useProject();
  const pageName = activeProjectName ?? activeProject?.name ?? "Your Page";
  const pageId = activeProject?.facebookPageId;

  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<PostTone>("friendly");
  const [goal, setGoal] = useState<PostGoal>("engagement");
  const [emoji, setEmoji] = useState(true);
  const [cta, setCta] = useState(true);
  const [withHashtags, setWithHashtags] = useState(false);

  const [variants, setVariants] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [rewriting, setRewriting] = useState<RewriteMode | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const caption = variants[activeIdx] ?? "";

  const setActiveCaption = useCallback(
    (next: string) => {
      setVariants((prev) => {
        const copy = [...prev];
        copy[activeIdx] = next;
        return copy;
      });
    },
    [activeIdx],
  );

  const generate = useCallback(
    async (regenerate = false) => {
      if (!brief.trim()) {
        setError("Describe what the post should be about first.");
        return;
      }
      setError(null);
      setStreaming(true);

      // New variant slot for this generation. The Generate buttons are disabled
      // while `streaming`, so no second generation can start before this one
      // finishes and re-renders — making `variants.length` an accurate slot id.
      const idx = variants.length;
      setVariants((prev) => [...prev, ""]);
      setActiveIdx(idx);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/meta/ai/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            brief,
            tone,
            goal,
            pageName,
            includeEmoji: emoji,
            includeCta: cta,
            includeHashtags: withHashtags,
            variantHint: regenerate ? `alternative angle #${idx + 1}` : undefined,
          }),
        });

        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(j?.error || "Generation failed. Please try again.");
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const errAt = acc.indexOf("[error]");
          if (errAt >= 0) {
            setError(acc.slice(errAt + 7).trim() || "AI request failed.");
            acc = acc.slice(0, errAt).trim();
            setVariants((prev) => {
              const copy = [...prev];
              copy[idx] = acc;
              return copy;
            });
            break;
          }
          setVariants((prev) => {
            const copy = [...prev];
            copy[idx] = acc;
            return copy;
          });
        }
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setError("Something went wrong while generating. Please try again.");
        }
      } finally {
        setStreaming(false);
      }
    },
    [brief, tone, goal, pageName, emoji, cta, withHashtags, variants.length],
  );

  const doRewrite = useCallback(
    async (mode: RewriteMode) => {
      if (!caption.trim() || rewriting) return;
      setRewriting(mode);
      setError(null);
      const res = await rewriteCaption(caption, mode);
      setRewriting(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.text) setActiveCaption(res.text);
    },
    [caption, rewriting, setActiveCaption],
  );

  const loadHashtags = useCallback(async () => {
    const topic = caption.trim() || brief.trim();
    if (!topic) {
      setError("Generate a caption or write a brief first.");
      return;
    }
    setLoadingTags(true);
    setError(null);
    const res = await suggestHashtags(topic);
    setLoadingTags(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setHashtags(res.hashtags ?? []);
  }, [caption, brief]);

  const loadIdeas = useCallback(async () => {
    const topic = brief.trim() || caption.trim();
    if (!topic) {
      setError("Write a brief first to brainstorm ideas.");
      return;
    }
    setLoadingIdeas(true);
    setError(null);
    const res = await suggestPostIdeas(topic);
    setLoadingIdeas(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setIdeas(res.ideas ?? []);
  }, [brief, caption]);

  const appendHashtag = useCallback(
    (tag: string) => {
      if (caption.includes(tag)) return;
      const sep = caption.endsWith("\n") || caption.length === 0 ? "" : " ";
      setActiveCaption(`${caption}${sep}${tag}`);
    },
    [caption, setActiveCaption],
  );

  const copy = useCallback(async () => {
    if (!caption.trim()) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }, [caption, toast]);

  const openInCreatePost = useCallback(() => {
    if (!caption.trim()) return;
    try {
      sessionStorage.setItem("meta-studio-caption", caption);
    } catch {
      /* non-fatal */
    }
    router.push("/dashboard/facebook/create-post");
  }, [caption, router]);

  const charCount = caption.length;
  const previewLines = useMemo(() => caption.split("\n"), [caption]);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-12">
      <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>AI Studio</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader className="mt-5" bordered={false}>
          <PageHeading>
            <PageEyebrow>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> AI Content Studio
              </span>
            </PageEyebrow>
            <PageTitle>Write your next post with AI</PageTitle>
            <PageDescription>
              Describe an idea, pick a tone, and generate scroll-stopping Facebook
              copy, then refine, add hashtags, and publish.
            </PageDescription>
          </PageHeading>
        </PageHeader>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* ---------------------------------------------------- composer -- */}
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            <Card padding="lg" className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="studio-brief" className="text-[12.5px] text-[var(--st-text)]">
                  What&apos;s this post about?
                </label>
                <Textarea
                  id="studio-brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. Announce our weekend flash sale: 30% off all summer styles, ends Sunday"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Tone
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <Chip key={t.value} active={tone === t.value} onClick={() => setTone(t.value)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Goal
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GOALS.map((g) => (
                    <Chip key={g.value} active={goal === g.value} onClick={() => setGoal(g.value)}>
                      {g.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Toggle active={emoji} onClick={() => setEmoji((v) => !v)}>
                  Emoji
                </Toggle>
                <Toggle active={cta} onClick={() => setCta((v) => !v)}>
                  Call to action
                </Toggle>
                <Toggle active={withHashtags} onClick={() => setWithHashtags((v) => !v)}>
                  Hashtags inline
                </Toggle>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => generate(false)}
                  disabled={streaming || !brief.trim()}
                  iconLeft={streaming ? undefined : Wand2}
                >
                  {streaming ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Generating…
                    </>
                  ) : variants.length > 0 ? (
                    "Generate new"
                  ) : (
                    "Generate post"
                  )}
                </Button>
                {variants.length > 0 ? (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => generate(true)}
                    disabled={streaming}
                    iconLeft={Sparkles}
                  >
                    Another variant
                  </Button>
                ) : null}
              </div>

              {error ? (
                <p className="flex items-start gap-1.5 text-[12.5px] text-[var(--st-danger,#dc2626)]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </p>
              ) : null}
            </Card>

            {/* generated caption */}
            {variants.length > 0 ? (
              <Card padding="lg" className="flex flex-col gap-3">
                {variants.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {variants.map((_, i) => (
                      <Chip key={i} active={i === activeIdx} onClick={() => setActiveIdx(i)}>
                        Variant {i + 1}
                      </Chip>
                    ))}
                  </div>
                ) : null}

                <div className="relative">
                  <Textarea
                    value={caption}
                    onChange={(e) => setActiveCaption(e.target.value)}
                    rows={6}
                    aria-label="Generated post"
                    placeholder="Your generated post will appear here…"
                    className="resize-none pr-2"
                  />
                  {streaming ? (
                    <span className="pointer-events-none absolute bottom-3 right-3 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-[var(--st-accent)]" />
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--st-text-tertiary)]">
                    {charCount} characters
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Pencil className="h-3 w-3 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                    <span className="text-[11px] text-[var(--st-text-tertiary)]">Editable</span>
                  </div>
                </div>

                {/* rewrite toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--st-border)] pt-3">
                  <span className="text-[11.5px] text-[var(--st-text-secondary)]">Refine:</span>
                  {REWRITES.map((r) => (
                    <button
                      key={r.mode}
                      type="button"
                      onClick={() => doRewrite(r.mode)}
                      disabled={!!rewriting || streaming}
                      className={cn(
                        "rounded-full border border-[var(--st-border)] px-2.5 py-1 text-[11.5px] text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)] disabled:opacity-50",
                        rewriting === r.mode && "border-[var(--st-accent)] text-[var(--st-accent)]",
                      )}
                    >
                      {rewriting === r.mode ? (
                        <span className="inline-flex items-center gap-1">
                          <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" /> {r.label}
                        </span>
                      ) : (
                        r.label
                      )}
                    </button>
                  ))}
                </div>
              </Card>
            ) : null}

            {/* hashtags + ideas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card padding="lg" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--st-text)]">
                    <Hash className="h-4 w-4" aria-hidden="true" /> Hashtags
                  </span>
                  <Button variant="ghost" size="sm" onClick={loadHashtags} disabled={loadingTags}>
                    {loadingTags ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      "Suggest"
                    )}
                  </Button>
                </div>
                <AnimatePresence initial={false}>
                  {hashtags.length > 0 ? (
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-wrap gap-1.5"
                    >
                      {hashtags.map((tag, i) => (
                        <m.button
                          key={tag}
                          type="button"
                          onClick={() => appendHashtag(tag)}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-1 text-[11.5px] text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-accent)] hover:text-[var(--st-accent)]"
                        >
                          {tag}
                        </m.button>
                      ))}
                    </m.div>
                  ) : (
                    <p className="text-[12px] text-[var(--st-text-tertiary)]">
                      Click suggest to get relevant hashtags. Tap a tag to add it.
                    </p>
                  )}
                </AnimatePresence>
              </Card>

              <Card padding="lg" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--st-text)]">
                    <Lightbulb className="h-4 w-4" aria-hidden="true" /> Idea spark
                  </span>
                  <Button variant="ghost" size="sm" onClick={loadIdeas} disabled={loadingIdeas}>
                    {loadingIdeas ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      "Brainstorm"
                    )}
                  </Button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {ideas.length > 0 ? (
                      ideas.map((idea, i) => (
                        <m.button
                          key={idea.title + i}
                          type="button"
                          onClick={() => setBrief(`${idea.title}: ${idea.angle}`)}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2.5 text-left transition-colors hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)]"
                        >
                          <p className="text-[12.5px] text-[var(--st-text)]">{idea.title}</p>
                          <p className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                            {idea.angle}
                          </p>
                        </m.button>
                      ))
                    ) : (
                      <p className="text-[12px] text-[var(--st-text-tertiary)]">
                        Stuck? Brainstorm 6 post angles from your brief.
                      </p>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            </div>
          </m.div>

          {/* ----------------------------------------------------- preview -- */}
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="lg:sticky lg:top-6 lg:self-start"
          >
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-[var(--st-border)] px-4 py-2.5">
                <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Live preview
                </span>
              </div>
              <div className="p-4">
                {/* fb post card */}
                <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                  <div className="flex items-center gap-2.5 p-3">
                    {pageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://graph.facebook.com/${pageId}/picture?type=square`}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <FacebookGlyph className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--st-text)]">
                        {pageName}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-[var(--st-text-tertiary)]">
                        Just now · <Globe className="h-3 w-3" aria-hidden="true" />
                      </p>
                    </div>
                  </div>

                  <div className="px-3 pb-2 text-[13px] leading-relaxed text-[var(--st-text)]">
                    {caption.trim() ? (
                      previewLines.map((line, i) => (
                        <p key={i} className={line ? "" : "h-3"}>
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-[var(--st-text-tertiary)]">
                        Your post preview will appear here as you generate.
                      </p>
                    )}
                  </div>

                  <div className="mx-3 flex aspect-video items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-tertiary)]">
                    <span className="text-[11.5px]">Media preview · add in Create Post</span>
                  </div>

                  <div className="mt-2 flex items-center justify-around border-t border-[var(--st-border)] px-3 py-1.5 text-[12px] text-[var(--st-text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Like
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Comment
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
                    </span>
                  </div>
                </div>

                {/* actions */}
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={openInCreatePost}
                    disabled={!caption.trim()}
                    iconRight={ArrowRight}
                  >
                    Use in Create Post
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={copy}
                    disabled={!caption.trim()}
                    iconLeft={copied ? Check : Copy}
                  >
                    {copied ? "Copied!" : "Copy caption"}
                  </Button>
                </div>

                {!activeProject ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={Facebook}
                      title="No page selected"
                      description="Pick a Facebook page to personalize the preview."
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          </m.div>
        </div>
      </div>
  );
}
