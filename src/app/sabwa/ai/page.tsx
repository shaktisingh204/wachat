"use client";

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
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  EmptyState,
  Input,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  Bot,
  Check,
  CircleSlash,
  Copy,
  Languages,
  Loader2,
  MessageCirclePlus,
  Pencil,
  Plus,
  ScrollText,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
  } from "lucide-react";

/**
 * /sabwa/ai — Per-chat AI tools + Auto-pilot.
 *
 * Two main panels:
 *  1. Per-chat AI tools — Suggest reply, Summarise chat, Translate, Tone.
 *     Each section calls the corresponding server action
 *     (`suggestReply`, `summariseChat`, `translateMessage`, plus a local
 *     tone-rewrite via `suggestReply` until a dedicated action exists).
 *     If the action returns "not implemented", we surface a Phase 2
 *     banner with a waitlist toast — UI is fully built and ready.
 *
 *  2. Auto-pilot — Big switch + whitelist editor + audit log.
 *     State is local for now; flipping the switch toasts a credit warning.
 *
 * Credits counter in the header reads from `getSabwaLimits(plan)`. The
 * plan string would come from `useProject().activeProject.plan` once
 * wired through — for Phase 1 we fall back to 'free'.
 *
 * Rebuilt on ZoruUI primitives. No tab UI — the four per-chat tools live
 * in a segmented Button switcher.
 */

import * as React from "react";
import Link from "next/link";

import { useProject } from "@/context/project-context";

import {
  suggestReply,
  summariseChat,
  translateMessage,
} from "@/app/actions/sabwa.actions";
import { useChats, useResolveJid } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import { getSabwaLimits } from "@/lib/sabwa/plan-limits";
import type { SabwaChat } from "@/lib/sabwa/types";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ar", label: "Arabic" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
];

const TONES: { id: string; label: string }[] = [
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "friendly", label: "Friendly" },
  { id: "empathetic", label: "Empathetic" },
  { id: "concise", label: "Concise" },
];

type ToolKey = "suggest" | "summary" | "translate" | "tone";

const TOOL_TABS: { key: ToolKey; label: string; icon: React.ReactNode }[] = [
  { key: "suggest", label: "Suggest", icon: <Wand2 className="h-3.5 w-3.5" /> },
  { key: "summary", label: "Summary", icon: <ScrollText className="h-3.5 w-3.5" /> },
  { key: "translate", label: "Translate", icon: <Languages className="h-3.5 w-3.5" /> },
  { key: "tone", label: "Tone", icon: <Pencil className="h-3.5 w-3.5" /> },
];

interface AutopilotAuditEntry {
  id: string;
  ts: Date;
  jid: string;
  action: string;
}

interface WhitelistEntry {
  jid: string;
  label?: string;
}

function isNotImplementedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /not implemented yet/i.test(msg) ||
    /not available yet/i.test(msg) ||
    /404/i.test(msg)
  );
}

// Module-level set so the "Coming soon" toast only fires once per tool per
// page session. Matches the engine-client 404 dedupe pattern in spirit.
const warnedTools = new Set<ToolKey | "autopilot">();

function quotaLabel(q: number | "unlimited" | "custom"): string {
  if (q === "unlimited") return "Unlimited";
  if (q === "custom") return "Custom";
  return q.toLocaleString();
}

export default function SabWaAIPage() {
  const toast = useZoruToast();
  const { sessionUser } = useProject();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';

  const plan = sessionUser?.plan?.name ?? "free";
  const limits = React.useMemo(() => getSabwaLimits(plan), [plan]);
  const aiEnabled = limits.aiReplies.enabled;

  // ── Tool switcher (replaces the previous Tabs UI) ─────────────────
  const [activeTool, setActiveTool] = React.useState<ToolKey>("suggest");

  // ── Chat picker ────────────────────────────────────────────────────
  const { data: chats, loading: chatsLoading } = useChats(sessionId);
  const resolveJid = useResolveJid(sessionId);
  const [chatPickerOpen, setChatPickerOpen] = React.useState(false);
  const [selectedJid, setSelectedJid] = React.useState<string | null>(null);

  const selectedChat: SabwaChat | undefined = React.useMemo(() => {
    if (!selectedJid || !chats) return undefined;
    return chats.find((c) => c.jid === selectedJid);
  }, [chats, selectedJid]);

  // ── Tool: Suggest reply ────────────────────────────────────────────
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [suggestPhase2, setSuggestPhase2] = React.useState(false);

  const notifyComingSoon = React.useCallback(
    (key: ToolKey | "autopilot", label: string) => {
      if (warnedTools.has(key)) return;
      warnedTools.add(key);
      toast.toast({
        title: `${label} — coming soon`,
        description: "Engine endpoint not available yet. We'll enable it soon.",
      });
    },
    [toast],
  );

  const handleSuggest = React.useCallback(async () => {
    if (!selectedJid) {
      toast.toast({
        title: "Pick a chat",
        description: "Select a conversation to generate replies for.",
      });
      return;
    }
    setSuggestLoading(true);
    setSuggestPhase2(false);
    try {
      const result = await suggestReply(sessionId, selectedJid, 3);
      if (result.ok) {
        setSuggestions(result.suggestions ?? []);
      } else if (isNotImplementedError(new Error(result.error))) {
        setSuggestPhase2(true);
        setSuggestions([]);
        notifyComingSoon("suggest", "Suggest reply");
      } else {
        toast.toast({
          title: "Couldn't generate replies",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setSuggestPhase2(true);
        setSuggestions([]);
        notifyComingSoon("suggest", "Suggest reply");
      } else {
        toast.toast({
          title: "Suggest reply failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setSuggestLoading(false);
    }
  }, [sessionId, selectedJid, toast, notifyComingSoon]);

  const handleSendToComposer = React.useCallback(
    (text: string) => {
      if (!selectedJid) return;
      try {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            `sabwa:composer-prefill:${selectedJid}`,
            text,
          );
        }
      } catch {
        // best-effort
      }
      const href = `/sabwa/inbox?jid=${encodeURIComponent(
        selectedJid,
      )}&prefill=1`;
      toast.toast({
        title: "Sent to composer",
        description: "Opening this conversation in the inbox.",
      });
      window.open(href, "_self");
    },
    [selectedJid, toast],
  );

  // ── Tool: Summarise ────────────────────────────────────────────────
  const [summaryWindow, setSummaryWindow] =
    React.useState<"24h" | "7d" | "all">("24h");
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [summaryPhase2, setSummaryPhase2] = React.useState(false);

  const handleSummarise = React.useCallback(async () => {
    if (!selectedJid) {
      toast.toast({ title: "Pick a chat first", variant: "destructive" });
      return;
    }
    setSummaryLoading(true);
    setSummaryPhase2(false);
    setSummary(null);
    try {
      const result = await summariseChat(sessionId, selectedJid, summaryWindow);
      if (result.ok) {
        setSummary(result.summary);
      } else if (isNotImplementedError(new Error(result.error))) {
        setSummaryPhase2(true);
        notifyComingSoon("summary", "Summarise chat");
      } else {
        toast.toast({
          title: "Couldn't summarise",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setSummaryPhase2(true);
        notifyComingSoon("summary", "Summarise chat");
      } else {
        toast.toast({
          title: "Summarise failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setSummaryLoading(false);
    }
  }, [sessionId, selectedJid, summaryWindow, toast, notifyComingSoon]);

  // ── Tool: Translate ────────────────────────────────────────────────
  const [translateSource, setTranslateSource] = React.useState("");
  const [translateTarget, setTranslateTarget] = React.useState("en");
  const [translateLoading, setTranslateLoading] = React.useState(false);
  const [translation, setTranslation] = React.useState<string | null>(null);
  const [detectedLang, setDetectedLang] = React.useState<string | undefined>();
  const [translatePhase2, setTranslatePhase2] = React.useState(false);

  const handleTranslate = React.useCallback(async () => {
    if (!translateSource.trim()) {
      toast.toast({ title: "Paste a message to translate" });
      return;
    }
    setTranslateLoading(true);
    setTranslatePhase2(false);
    setTranslation(null);
    setDetectedLang(undefined);
    try {
      // Phase 1: translateMessage takes a messageId; we pass the pasted body
      // wrapped in a synthetic id so the engine can route it once wired.
      const syntheticId = `manual:${btoa(translateSource).slice(0, 24)}`;
      const result = await translateMessage(syntheticId, translateTarget);
      if (result.ok) {
        setTranslation(result.translation);
        setDetectedLang(result.detectedLang);
      } else if (isNotImplementedError(new Error(result.error))) {
        setTranslatePhase2(true);
        notifyComingSoon("translate", "Translate");
      } else {
        toast.toast({
          title: "Translation failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setTranslatePhase2(true);
        notifyComingSoon("translate", "Translate");
      } else {
        toast.toast({
          title: "Translation failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setTranslateLoading(false);
    }
  }, [translateSource, translateTarget, toast, notifyComingSoon]);

  // ── Tool: Tone rewrite ─────────────────────────────────────────────
  const [toneDraft, setToneDraft] = React.useState("");
  const [tone, setTone] = React.useState("casual");
  const [toneLoading, setToneLoading] = React.useState(false);
  const [toneOutput, setToneOutput] = React.useState<string | null>(null);
  const [tonePhase2, setTonePhase2] = React.useState(false);

  const handleTone = React.useCallback(async () => {
    if (!toneDraft.trim()) {
      toast.toast({ title: "Type a draft to rewrite" });
      return;
    }
    setToneLoading(true);
    setTonePhase2(false);
    setToneOutput(null);
    try {
      // Tone-rewrite reuses suggestReply with a synthetic prompt-channel jid
      // until a dedicated action exists. The engine can multiplex on it.
      const result = await suggestReply(
        sessionId,
        `tone:${tone}:${btoa(toneDraft).slice(0, 32)}`,
        1,
      );
      if (result.ok && result.suggestions?.[0]) {
        setToneOutput(result.suggestions[0]);
      } else if (result.ok) {
        setToneOutput(toneDraft);
      } else if (isNotImplementedError(new Error(result.error))) {
        setTonePhase2(true);
        notifyComingSoon("tone", "Tone rewrite");
      } else {
        toast.toast({
          title: "Tone rewrite failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setTonePhase2(true);
        notifyComingSoon("tone", "Tone rewrite");
      } else {
        toast.toast({
          title: "Tone rewrite failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setToneLoading(false);
    }
  }, [sessionId, tone, toneDraft, toast, notifyComingSoon]);

  // ── Auto-pilot ─────────────────────────────────────────────────────
  const [autopilot, setAutopilot] = React.useState(false);
  const [whitelist, setWhitelist] = React.useState<WhitelistEntry[]>([]);
  const [whitelistInput, setWhitelistInput] = React.useState("");
  const [auditLog, setAuditLog] = React.useState<AutopilotAuditEntry[]>([]);

  const toggleAutopilot = React.useCallback(
    (next: boolean) => {
      if (!aiEnabled) {
        toast.toast({
          title: "AI is not on your plan",
          description: "Upgrade to Pro to enable Auto-pilot.",
          variant: "destructive",
        });
        return;
      }
      // No `setAutoPilotMode` server action exists yet — gate the toggle
      // behind a one-time "coming soon" toast and keep the switch off.
      notifyComingSoon("autopilot", "Auto-pilot");
      setAutopilot(false);
      void next;
    },
    [aiEnabled, toast, notifyComingSoon],
  );

  const handleAddWhitelist = React.useCallback(() => {
    const raw = whitelistInput.trim();
    if (!raw) return;
    const jid = raw.includes("@") ? raw : `${raw.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
    if (whitelist.some((w) => w.jid === jid)) {
      toast.toast({ title: "Already whitelisted" });
      return;
    }
    setWhitelist((prev) => [...prev, { jid, label: raw }]);
    setWhitelistInput("");
  }, [whitelistInput, whitelist, toast]);

  const handleRemoveWhitelist = React.useCallback((jid: string) => {
    setWhitelist((prev) => prev.filter((w) => w.jid !== jid));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
  if (!aiEnabled) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Sparkles />}
          title="Upgrade required"
          description="AI tools are a Pro feature. Upgrade to unlock suggested replies, summaries, translation, tone rewrites, and Auto-pilot."
          action={
            <Link href="/dashboard/plans">
              <Button size="md">View plans</Button>
            </Link>
          }
        />
      </div>
    );
  }

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
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      {/* Breadcrumb */}
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
            <ZoruBreadcrumbPage>AI assistant</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header + credits counter */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink"
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
              AI Assistant
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-zoru-ink-muted">
            Per-chat AI tools and an optional Auto-pilot mode that replies to
            whitelisted contacts. Every AI action consumes credits.
          </p>
        </div>
        <Card className="ml-auto w-full sm:w-auto">
          <ZoruCardContent className="flex items-center gap-3 p-3">
            <Wand2 className="h-4 w-4 text-zoru-ink-muted" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-zoru-ink-muted">
                Monthly AI credits
              </div>
              <div className="text-[15px] font-semibold leading-none text-zoru-ink">
                {quotaLabel(limits.aiReplies.monthlyQuota)}
              </div>
            </div>
          </ZoruCardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Per-chat AI tools panel ──────────────────────────────── */}
        <Card className="lg:col-span-2">
          <ZoruCardHeader>
            <ZoruCardTitle className="text-[14px]">
              Per-chat AI tools
            </ZoruCardTitle>
            <ZoruCardDescription>
              Pick a chat and route its context through one of four tools.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            {/* Chat picker */}
            <div className="space-y-2">
              <Label className="text-[11.5px] font-medium">Chat</Label>
              <Popover
                open={chatPickerOpen}
                onOpenChange={setChatPickerOpen}
              >
                <ZoruPopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={chatPickerOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedJid
                        ? resolveJid(selectedJid)
                        : "Select a chat..."}
                    </span>
                    <MessageCirclePlus className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent className="w-[min(420px,90vw)] p-0">
                  <ZoruCommand>
                    <ZoruCommandInput placeholder="Search chats..." />
                    <ZoruCommandList>
                      {chatsLoading && (
                        <div className="p-3">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="mt-2 h-8 w-full" />
                        </div>
                      )}
                      <ZoruCommandEmpty>
                        {chatsLoading ? "Loading..." : "No chats found."}
                      </ZoruCommandEmpty>
                      <ZoruCommandGroup>
                        {(chats ?? []).map((c) => {
                          const label = resolveJid(c.jid);
                          return (
                          <ZoruCommandItem
                            key={c.jid}
                            value={`${label} ${c.jid}`}
                            onSelect={() => {
                              setSelectedJid(c.jid);
                              setChatPickerOpen(false);
                            }}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate text-[13px]">
                                {label}
                              </span>
                              {c.unreadCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 text-[10px]"
                                >
                                  {c.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </ZoruCommandItem>
                          );
                        })}
                      </ZoruCommandGroup>
                    </ZoruCommandList>
                  </ZoruCommand>
                </ZoruPopoverContent>
              </Popover>
            </div>

            {/* Segmented tool switcher — replaces the previous Tabs UI */}
            <div
              role="tablist"
              aria-label="AI tool"
              className="inline-flex w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1"
            >
              {TOOL_TABS.map((tab) => {
                const isActive = activeTool === tab.key;
                return (
                  <Button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "flex-1 gap-1.5 rounded-[calc(var(--zoru-radius)-2px)]",
                    )}
                    onClick={() => setActiveTool(tab.key)}
                  >
                    {tab.icon}
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            {/* Suggest reply */}
            {activeTool === "suggest" && (
              <div className="space-y-3">
                <p className="text-[11.5px] text-zoru-ink-muted">
                  Generates three candidate replies from the last messages in
                  the chosen chat. Pick one to send to the inbox composer.
                </p>
                <Button
                  type="button"
                  onClick={handleSuggest}
                  disabled={suggestLoading || !selectedJid}
                >
                  {suggestLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generate 3 replies
                </Button>

                {suggestPhase2 && <Phase2Banner topic="Suggest reply" />}

                {suggestions.length > 0 && (
                  <ul className="space-y-2">
                    {suggestions.map((s, i) => (
                      <li key={i}>
                        <Card>
                          <ZoruCardContent className="flex items-start gap-3 p-3">
                            <span className="text-[13px] text-zoru-ink">
                              {s}
                            </span>
                            <div className="ml-auto flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(s);
                                  toast.toast({ title: "Copied" });
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSendToComposer(s)}
                              >
                                <Send className="mr-1 h-3.5 w-3.5" />
                                Use
                              </Button>
                            </div>
                          </ZoruCardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Summarise */}
            {activeTool === "summary" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11.5px] font-medium">
                      Window
                    </Label>
                    <Select
                      value={summaryWindow}
                      onValueChange={(v) =>
                        setSummaryWindow(v as "24h" | "7d" | "all")
                      }
                    >
                      <ZoruSelectTrigger className="w-[160px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="24h">Last 24h</ZoruSelectItem>
                        <ZoruSelectItem value="7d">Last 7 days</ZoruSelectItem>
                        <ZoruSelectItem value="all">All time</ZoruSelectItem>
                      </ZoruSelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSummarise}
                    disabled={summaryLoading || !selectedJid}
                  >
                    {summaryLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ScrollText className="mr-2 h-4 w-4" />
                    )}
                    Summarise
                  </Button>
                </div>

                {summaryPhase2 && <Phase2Banner topic="Summarise chat" />}

                {summary && (
                  <Card>
                    <ZoruCardContent className="space-y-2 p-3">
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zoru-ink">
                        {summary}
                      </p>
                    </ZoruCardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Translate */}
            {activeTool === "translate" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[11.5px] font-medium">
                    Message text
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Paste a message to translate..."
                    value={translateSource}
                    onChange={(e) => setTranslateSource(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11.5px] font-medium">
                      Target
                    </Label>
                    <Select
                      value={translateTarget}
                      onValueChange={setTranslateTarget}
                    >
                      <ZoruSelectTrigger className="w-[180px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {LANGUAGES.map((l) => (
                          <ZoruSelectItem key={l.code} value={l.code}>
                            {l.label}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleTranslate}
                    disabled={translateLoading || !translateSource.trim()}
                  >
                    {translateLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Languages className="mr-2 h-4 w-4" />
                    )}
                    Translate
                  </Button>
                </div>

                {translatePhase2 && <Phase2Banner topic="Translate" />}

                {translation && (
                  <Card>
                    <ZoruCardContent className="space-y-2 p-3">
                      {detectedLang && (
                        <Badge variant="secondary" className="text-[10px]">
                          Detected: {detectedLang}
                        </Badge>
                      )}
                      <p className="text-[13px] text-zoru-ink">{translation}</p>
                    </ZoruCardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tone rewrite */}
            {activeTool === "tone" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[11.5px] font-medium">
                    Draft
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Paste your draft reply..."
                    value={toneDraft}
                    onChange={(e) => setToneDraft(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11.5px] font-medium">
                      Tone
                    </Label>
                    <Select value={tone} onValueChange={setTone}>
                      <ZoruSelectTrigger className="w-[180px]">
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {TONES.map((t) => (
                          <ZoruSelectItem key={t.id} value={t.id}>
                            {t.label}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={handleTone}
                    disabled={toneLoading || !toneDraft.trim()}
                  >
                    {toneLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="mr-2 h-4 w-4" />
                    )}
                    Rewrite
                  </Button>
                </div>

                {tonePhase2 && <Phase2Banner topic="Tone rewrite" />}

                {toneOutput && (
                  <Card>
                    <ZoruCardContent className="space-y-2 p-3">
                      <p className="text-[13px] text-zoru-ink">{toneOutput}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard?.writeText(toneOutput);
                          toast.toast({ title: "Copied rewritten draft" });
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                      </Button>
                    </ZoruCardContent>
                  </Card>
                )}
              </div>
            )}
          </ZoruCardContent>
        </Card>

        {/* ── Auto-pilot panel ─────────────────────────────────────── */}
        <Card>
          <ZoruCardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <ZoruCardTitle className="text-[14px]">
                  Auto-pilot mode
                </ZoruCardTitle>
                <ZoruCardDescription>
                  AI replies autonomously to whitelisted contacts.
                </ZoruCardDescription>
              </div>
              <Switch
                checked={autopilot}
                onCheckedChange={toggleAutopilot}
                aria-label="Toggle auto-pilot"
              />
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <Alert>
              <Bot className="h-4 w-4" />
              <ZoruAlertTitle>Credits warning</ZoruAlertTitle>
              <ZoruAlertDescription>
                Each AI reply spends one credit. Monthly cap:{" "}
                {quotaLabel(limits.aiReplies.monthlyQuota)}.
              </ZoruAlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-[11.5px] font-medium">
                Whitelist
              </Label>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddWhitelist();
                }}
              >
                <Input
                  placeholder="Phone or JID"
                  value={whitelistInput}
                  onChange={(e) => setWhitelistInput(e.target.value)}
                />
                <Button type="submit" size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
              {whitelist.length === 0 ? (
                <p className="text-[11.5px] text-zoru-ink-muted">
                  Add at least one contact for Auto-pilot to act on.
                </p>
              ) : (
                <ul className="space-y-1">
                  {whitelist.map((w) => (
                    <li
                      key={w.jid}
                      className="flex items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2 py-1"
                    >
                      <span className="truncate text-[11.5px] text-zoru-ink">
                        {w.label ?? w.jid}
                      </span>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleRemoveWhitelist(w.jid)}
                        aria-label={`Remove ${w.label ?? w.jid}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[11.5px] font-medium">
                Audit log
              </Label>
              <ScrollArea className="h-[160px] rounded-[var(--zoru-radius)] border border-zoru-line">
                {auditLog.length === 0 ? (
                  <p className="p-3 text-[11.5px] text-zoru-ink-muted">
                    No Auto-pilot actions yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-zoru-line">
                    {auditLog.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-[11.5px]"
                      >
                        <Check className="h-3 w-3 text-zoru-success" />
                        <span className="font-medium text-zoru-ink">
                          {entry.action}
                        </span>
                        <span className="ml-auto text-zoru-ink-muted">
                          {entry.ts.toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </ZoruCardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function Phase2Banner({ topic }: { topic: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2 text-[11.5px] text-zoru-ink-muted"
      role="status"
    >
      <CircleSlash className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-medium text-zoru-ink">{topic}</span> — engine
        endpoint not available yet.
      </span>
    </div>
  );
}
