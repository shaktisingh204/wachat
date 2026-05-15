"use client";

/**
 * /sabwa/ai — Per-chat AI tools + Auto-pilot.
 *
 * Two main panels:
 *  1. Per-chat AI tools — Suggest reply, Summarise chat, Translate, Tone.
 *     Each tab calls the corresponding server action
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
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
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
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/context/project-context";

import {
  suggestReply,
  summariseChat,
  translateMessage,
} from "@/app/actions/sabwa.actions";
import { useChats } from "@/lib/sabwa/use-sabwa-data";
import { getSabwaLimits } from "@/lib/sabwa/plan-limits";
import type { SabwaChat } from "@/lib/sabwa/types";

const PLACEHOLDER_SESSION_ID = "stub-primary";

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
  return /not implemented yet/i.test(msg);
}

function quotaLabel(q: number | "unlimited" | "custom"): string {
  if (q === "unlimited") return "Unlimited";
  if (q === "custom") return "Custom";
  return q.toLocaleString();
}

export default function SabWaAIPage() {
  const { toast } = useToast();
  const { activeProject } = useProject();
  const sessionId = PLACEHOLDER_SESSION_ID;

  const plan =
    ((activeProject as unknown as { plan?: string } | null)?.plan) ?? "free";
  const limits = React.useMemo(() => getSabwaLimits(plan), [plan]);
  const aiEnabled = limits.aiReplies.enabled;

  // ── Chat picker ────────────────────────────────────────────────────
  const { data: chats, loading: chatsLoading } = useChats(sessionId);
  const [chatPickerOpen, setChatPickerOpen] = React.useState(false);
  const [selectedJid, setSelectedJid] = React.useState<string | null>(null);

  const selectedChat: SabwaChat | undefined = React.useMemo(() => {
    if (!selectedJid || !chats) return undefined;
    return chats.find((c) => c.jid === selectedJid);
  }, [chats, selectedJid]);

  // ── Tab: Suggest reply ─────────────────────────────────────────────
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [suggestPhase2, setSuggestPhase2] = React.useState(false);

  const handleSuggest = React.useCallback(async () => {
    if (!selectedJid) {
      toast({
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
      } else {
        toast({
          title: "Couldn't generate replies",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setSuggestPhase2(true);
        setSuggestions([]);
      } else {
        toast({
          title: "Suggest reply failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setSuggestLoading(false);
    }
  }, [sessionId, selectedJid, toast]);

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
      toast({
        title: "Sent to composer",
        description: "Opening this conversation in the inbox.",
      });
      window.open(href, "_self");
    },
    [selectedJid, toast],
  );

  // ── Tab: Summarise ─────────────────────────────────────────────────
  const [summaryWindow, setSummaryWindow] =
    React.useState<"24h" | "7d" | "all">("24h");
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [summaryPhase2, setSummaryPhase2] = React.useState(false);

  const handleSummarise = React.useCallback(async () => {
    if (!selectedJid) {
      toast({ title: "Pick a chat first", variant: "destructive" });
      return;
    }
    setSummaryLoading(true);
    setSummaryPhase2(false);
    setSummary(null);
    try {
      const result = await summariseChat(sessionId, selectedJid, summaryWindow);
      if (result.ok) {
        setSummary(result.summary);
      } else {
        toast({
          title: "Couldn't summarise",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setSummaryPhase2(true);
      } else {
        toast({
          title: "Summarise failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setSummaryLoading(false);
    }
  }, [sessionId, selectedJid, summaryWindow, toast]);

  // ── Tab: Translate ─────────────────────────────────────────────────
  const [translateSource, setTranslateSource] = React.useState("");
  const [translateTarget, setTranslateTarget] = React.useState("en");
  const [translateLoading, setTranslateLoading] = React.useState(false);
  const [translation, setTranslation] = React.useState<string | null>(null);
  const [detectedLang, setDetectedLang] = React.useState<string | undefined>();
  const [translatePhase2, setTranslatePhase2] = React.useState(false);

  const handleTranslate = React.useCallback(async () => {
    if (!translateSource.trim()) {
      toast({ title: "Paste a message to translate" });
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
      } else {
        toast({
          title: "Translation failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setTranslatePhase2(true);
      } else {
        toast({
          title: "Translation failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setTranslateLoading(false);
    }
  }, [translateSource, translateTarget, toast]);

  // ── Tab: Tone rewrite ──────────────────────────────────────────────
  const [toneDraft, setToneDraft] = React.useState("");
  const [tone, setTone] = React.useState("casual");
  const [toneLoading, setToneLoading] = React.useState(false);
  const [toneOutput, setToneOutput] = React.useState<string | null>(null);
  const [tonePhase2, setTonePhase2] = React.useState(false);

  const handleTone = React.useCallback(async () => {
    if (!toneDraft.trim()) {
      toast({ title: "Type a draft to rewrite" });
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
      } else {
        toast({
          title: "Tone rewrite failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (isNotImplementedError(err)) {
        setTonePhase2(true);
      } else {
        toast({
          title: "Tone rewrite failed",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      }
    } finally {
      setToneLoading(false);
    }
  }, [sessionId, tone, toneDraft, toast]);

  // ── Auto-pilot ─────────────────────────────────────────────────────
  const [autopilot, setAutopilot] = React.useState(false);
  const [whitelist, setWhitelist] = React.useState<WhitelistEntry[]>([]);
  const [whitelistInput, setWhitelistInput] = React.useState("");
  const [auditLog, setAuditLog] = React.useState<AutopilotAuditEntry[]>([]);

  const toggleAutopilot = React.useCallback(
    (next: boolean) => {
      if (!aiEnabled) {
        toast({
          title: "AI is not on your plan",
          description: "Upgrade to Pro to enable Auto-pilot.",
          variant: "destructive",
        });
        return;
      }
      setAutopilot(next);
      if (next) {
        toast({
          title: "Auto-pilot on",
          description:
            "AI will reply to whitelisted contacts. Each reply consumes 1 AI credit.",
          variant: "destructive",
        });
        setAuditLog((prev) => [
          {
            id: `audit-${Date.now()}`,
            ts: new Date(),
            jid: "system",
            action: "Auto-pilot enabled",
          },
          ...prev,
        ]);
      } else {
        toast({
          title: "Auto-pilot off",
          description: "AI will no longer reply on your behalf.",
        });
        setAuditLog((prev) => [
          {
            id: `audit-${Date.now()}`,
            ts: new Date(),
            jid: "system",
            action: "Auto-pilot disabled",
          },
          ...prev,
        ]);
      }
    },
    [aiEnabled, toast],
  );

  const handleAddWhitelist = React.useCallback(() => {
    const raw = whitelistInput.trim();
    if (!raw) return;
    const jid = raw.includes("@") ? raw : `${raw.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
    if (whitelist.some((w) => w.jid === jid)) {
      toast({ title: "Already whitelisted" });
      return;
    }
    setWhitelist((prev) => [...prev, { jid, label: raw }]);
    setWhitelistInput("");
  }, [whitelistInput, whitelist, toast]);

  const handleRemoveWhitelist = React.useCallback((jid: string) => {
    setWhitelist((prev) => prev.filter((w) => w.jid !== jid));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header + credits counter */}
      <div className="flex flex-wrap items-start gap-3">
        <div
          aria-hidden
          className="rounded-xl bg-secondary p-3 text-secondary-foreground"
        >
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              AI Assistant
            </h1>
            {!aiEnabled && (
              <Badge variant="destructive">Not on your plan</Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Per-chat AI tools and an optional Auto-pilot mode that replies to
            whitelisted contacts. Every AI action consumes credits.
          </p>
        </div>
        <Card className="ml-auto w-full sm:w-auto">
          <CardContent className="flex items-center gap-3 p-3">
            <Wand2 className="h-4 w-4 text-muted-foreground" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Monthly AI credits
              </div>
              <div className="text-base font-semibold leading-none">
                {quotaLabel(limits.aiReplies.monthlyQuota)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!aiEnabled && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>AI tools require Pro or higher</AlertTitle>
          <AlertDescription>
            All controls below are visible for preview. Upgrade your plan to
            actually run AI generation against your chats.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Per-chat AI tools panel ──────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Per-chat AI tools</CardTitle>
            <CardDescription>
              Pick a chat and route its context through one of four tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Chat picker */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Chat</Label>
              <Popover open={chatPickerOpen} onOpenChange={setChatPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={chatPickerOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedChat
                        ? selectedChat.name ?? selectedChat.jid
                        : "Select a chat..."}
                    </span>
                    <MessageCirclePlus className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(420px,90vw)] p-0">
                  <Command>
                    <CommandInput placeholder="Search chats..." />
                    <CommandList>
                      {chatsLoading && (
                        <div className="p-3">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="mt-2 h-8 w-full" />
                        </div>
                      )}
                      <CommandEmpty>
                        {chatsLoading ? "Loading..." : "No chats found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {(chats ?? []).map((c) => (
                          <CommandItem
                            key={c.jid}
                            value={`${c.name ?? ""} ${c.jid}`}
                            onSelect={() => {
                              setSelectedJid(c.jid);
                              setChatPickerOpen(false);
                            }}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate text-sm">
                                {c.name ?? c.jid}
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
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Tabs defaultValue="suggest" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="suggest">
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  Suggest
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <ScrollText className="mr-1.5 h-3.5 w-3.5" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="translate">
                  <Languages className="mr-1.5 h-3.5 w-3.5" />
                  Translate
                </TabsTrigger>
                <TabsTrigger value="tone">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Tone
                </TabsTrigger>
              </TabsList>

              {/* Suggest reply */}
              <TabsContent value="suggest" className="space-y-3 pt-4">
                <p className="text-xs text-muted-foreground">
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
                          <CardContent className="flex items-start gap-3 p-3">
                            <span className="text-sm">{s}</span>
                            <div className="ml-auto flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(s);
                                  toast({ title: "Copied" });
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
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              {/* Summarise */}
              <TabsContent value="summary" className="space-y-3 pt-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Window</Label>
                    <Select
                      value={summaryWindow}
                      onValueChange={(v) =>
                        setSummaryWindow(v as "24h" | "7d" | "all")
                      }
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24h</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
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
                    <CardContent className="space-y-2 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {summary}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Translate */}
              <TabsContent value="translate" className="space-y-3 pt-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Message text</Label>
                  <Textarea
                    rows={3}
                    placeholder="Paste a message to translate..."
                    value={translateSource}
                    onChange={(e) => setTranslateSource(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Target</Label>
                    <Select
                      value={translateTarget}
                      onValueChange={setTranslateTarget}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
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
                    <CardContent className="space-y-2 p-3">
                      {detectedLang && (
                        <Badge variant="secondary" className="text-[10px]">
                          Detected: {detectedLang}
                        </Badge>
                      )}
                      <p className="text-sm">{translation}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tone rewrite */}
              <TabsContent value="tone" className="space-y-3 pt-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Draft</Label>
                  <Textarea
                    rows={3}
                    placeholder="Paste your draft reply..."
                    value={toneDraft}
                    onChange={(e) => setToneDraft(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
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
                    <CardContent className="space-y-2 p-3">
                      <p className="text-sm">{toneOutput}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard?.writeText(toneOutput);
                          toast({ title: "Copied rewritten draft" });
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Auto-pilot panel ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Auto-pilot mode</CardTitle>
                <CardDescription>
                  AI replies autonomously to whitelisted contacts.
                </CardDescription>
              </div>
              <Switch
                checked={autopilot}
                onCheckedChange={toggleAutopilot}
                aria-label="Toggle auto-pilot"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertTitle>Credits warning</AlertTitle>
              <AlertDescription>
                Each AI reply spends one credit. Monthly cap:{" "}
                {quotaLabel(limits.aiReplies.monthlyQuota)}.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Whitelist</Label>
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
                <p className="text-xs text-muted-foreground">
                  Add at least one contact for Auto-pilot to act on.
                </p>
              ) : (
                <ul className="space-y-1">
                  {whitelist.map((w) => (
                    <li
                      key={w.jid}
                      className="flex items-center justify-between gap-2 rounded-md border bg-card/60 px-2 py-1"
                    >
                      <span className="truncate text-xs">
                        {w.label ?? w.jid}
                      </span>
                      <Button
                        type="button"
                        size="icon"
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
              <Label className="text-xs font-medium">Audit log</Label>
              <ScrollArea className="h-[160px] rounded-md border">
                {auditLog.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    No Auto-pilot actions yet.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {auditLog.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs"
                      >
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="font-medium">{entry.action}</span>
                        <span className="ml-auto text-muted-foreground">
                          {entry.ts.toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function Phase2Banner({ topic }: { topic: string }) {
  const { toast } = useToast();
  return (
    <Alert>
      <CircleSlash className="h-4 w-4" />
      <AlertTitle>{topic} — Phase 2</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>The engine isn&apos;t wired for this yet.</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            toast({
              title: "Added to waitlist",
              description: `We'll email you when ${topic} ships.`,
            })
          }
        >
          Join waitlist
        </Button>
        <Button asChild type="button" size="sm" variant="ghost">
          <Link href="/sabwa/settings">
            <X className="mr-1 h-3.5 w-3.5" /> Dismiss
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
