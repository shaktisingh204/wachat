"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitCompareArrows,
  History,
  Plus,
  Save,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
  Textarea,
} from "@/components/zoruui";
import { SabsmsDetailDrawer, SabsmsKbdHint } from "@/components/sabsms/page-toolkit";

import { AiRewriteToolbar } from "./ai-rewrite";
import { TemplatePreview } from "./preview";
import {
  diffAgainstPublished,
  publishTemplate,
  saveDraft,
  submitForApproval,
  withdrawTemplate,
  type DiffActionResult,
  type SaveTemplateInput,
} from "./actions";
import {
  SUPPORTED_LOCALES,
  TEMPLATE_CATEGORIES,
  type LocaleCode,
  type TemplateEditorViewModel,
  type VariableDefault,
} from "./types";
import type { SabsmsTemplateCategory } from "@/lib/sabsms/types";

const DATE_SNIPPETS = [
  "{{ now | date('YYYY-MM-DD') }}",
  "{{ now | date('YYYY-MM-DD HH:mm') }}",
  "{{ now | date('DD/MM/YYYY') }}",
];

function detectVariables(bodies: { locale: string; body: string }[]): string[] {
  const set = new Set<string>();
  for (const b of bodies) {
    const matches = b.body.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? [];
    for (const m of matches) {
      const inner = m.replace(/[{}]/g, "").trim();
      if (inner && inner !== "now") set.add(inner);
    }
  }
  return [...set];
}

function piiScrub(body: string): string {
  return body
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, "[REDACTED_PHONE]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[REDACTED_EMAIL]");
}

export interface TemplateEditorProps {
  initial: TemplateEditorViewModel;
  /** Indicates `id === "new"`. */
  isNew: boolean;
}

export function TemplateEditor({ initial, isNew }: TemplateEditorProps) {
  const router = useRouter();
  const [vm, setVm] = useState<TemplateEditorViewModel>(initial);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>(
    (initial.bodies[0]?.locale as LocaleCode) ?? "en",
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [varsHelpOpen, setVarsHelpOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState<DiffActionResult | null>(null);
  const [piiOpen, setPiiOpen] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState(initial.reviewerNotes);
  const [payloadJson, setPayloadJson] = useState("{\n\n}");
  const sampleVars = useMemo(() => {
    try {
      const parsed = JSON.parse(payloadJson);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }, [payloadJson]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [varSuggestOpen, setVarSuggestOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const detectedVars = useMemo(() => detectVariables(vm.bodies), [vm.bodies]);

  // Keep `variableDefaults` in step with the variables we've detected —
  // add stubs for any new var name we just saw, drop entries the user
  // removed from every body.
  useEffect(() => {
    setVm((prev) => {
      const byName = new Map(prev.variableDefaults.map((v) => [v.name, v]));
      const next: VariableDefault[] = detectedVars.map((name) =>
        byName.get(name) ?? { name, defaultValue: "" },
      );
      // Preserve user-added entries that aren't in any body yet.
      for (const v of prev.variableDefaults) {
        if (!detectedVars.includes(v.name)) {
          next.push(v);
        }
      }
      // No-op fast-path to avoid an extra render loop.
      const same =
        next.length === prev.variableDefaults.length &&
        next.every(
          (v, i) =>
            v.name === prev.variableDefaults[i]?.name &&
            v.defaultValue === prev.variableDefaults[i]?.defaultValue,
        );
      return same ? prev : { ...prev, variableDefaults: next };
    });
  }, [detectedVars]);

  const activeBodyIndex = vm.bodies.findIndex((b) => b.locale === activeLocale);
  const activeBody = activeBodyIndex >= 0 ? vm.bodies[activeBodyIndex].body : "";

  function setBodyForLocale(locale: LocaleCode, body: string) {
    setVm((prev) => {
      const idx = prev.bodies.findIndex((b) => b.locale === locale);
      if (idx === -1) {
        return { ...prev, bodies: [...prev.bodies, { locale, body }] };
      }
      const next = prev.bodies.slice();
      next[idx] = { locale, body };
      return { ...prev, bodies: next };
    });
  }

  function removeLocale(locale: LocaleCode) {
    setVm((prev) => {
      const next = prev.bodies.filter((b) => b.locale !== locale);
      return {
        ...prev,
        bodies: next.length ? next : [{ locale: "en", body: "" }],
      };
    });
    if (activeLocale === locale) setActiveLocale("en");
  }

  function insertSnippet(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      setBodyForLocale(activeLocale, activeBody + snippet);
      return;
    }
    const start = el.selectionStart ?? activeBody.length;
    const end = el.selectionEnd ?? activeBody.length;
    const next = activeBody.slice(0, start) + snippet + activeBody.slice(end);
    setBodyForLocale(activeLocale, next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  }

  function buildSaveInput(): SaveTemplateInput {
    return {
      id: vm.id,
      name: vm.name,
      category: vm.category,
      bodies: vm.bodies,
      variableDefaults: vm.variableDefaults,
      metadata: vm.metadata,
    };
  }

  const handleSave = useCallback(() => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await saveDraft(buildSaveInput());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInfo("Draft saved");
      setVm((prev) => ({ ...prev, status: res.status, id: res.id }));
      if (isNew && res.id) {
        router.replace(`/sabsms/templates/${res.id}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm, isNew, router]);

  const handlePublish = useCallback(() => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await publishTemplate(buildSaveInput());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInfo("Template published");
      setVm((prev) => ({ ...prev, status: res.status, id: res.id }));
      if (isNew && res.id) {
        router.replace(`/sabsms/templates/${res.id}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm, isNew, router]);

  // Keyboard shortcuts (#29 from toolkit + page-level Cmd+S / Cmd+Enter / Cmd+/).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlePublish();
      } else if (e.key === "/") {
        e.preventDefault();
        setVarsHelpOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleSave, handlePublish]);

  function handleSubmitForApproval() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await submitForApproval({
        ...buildSaveInput(),
        reviewerNotes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInfo("Submitted for approval");
      setVm((prev) => ({ ...prev, status: res.status, id: res.id }));
    });
  }

  function handleWithdraw() {
    if (!vm.id) return;
    startTransition(async () => {
      const res = await withdrawTemplate(vm.id);
      if (!res.ok) setError(res.error);
      else {
        setInfo("Withdrawn — back to draft");
        setVm((prev) => ({ ...prev, status: "draft" }));
      }
    });
  }

  async function openDiff() {
    setDiffOpen(true);
    setDiffData(null);
    const res = await diffAgainstPublished({
      id: vm.id || "new",
      locale: activeLocale,
      current: activeBody,
    });
    setDiffData(res);
  }

  // Variable autocomplete — toggle a popover when the user is typing
  // immediately after `{{` in the textarea.
  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBodyForLocale(activeLocale, v);
    const caret = e.target.selectionStart ?? v.length;
    const before = v.slice(Math.max(0, caret - 4), caret);
    setVarSuggestOpen(before.endsWith("{{") || /\{\{\s?\w*$/.test(before));
  }

  function insertVar(name: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? activeBody.length;
    // If the user just typed `{{`, append the rest; otherwise insert a
    // fresh `{{ name }}`.
    const before = activeBody.slice(Math.max(0, start - 2), start);
    const snippet = before === "{{" ? ` ${name} }}` : `{{ ${name} }}`;
    const next =
      activeBody.slice(0, start) + snippet + activeBody.slice(start);
    setBodyForLocale(activeLocale, next);
    setVarSuggestOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* ── Left column — primary editor ─────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <ZoruCardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <ZoruCardTitle>Template</ZoruCardTitle>
                  <ZoruCardDescription>
                    Variables use{" "}
                    <code className="rounded bg-zoru-surface-2 px-1 text-xs">
                      {"{{ name }}"}
                    </code>{" "}
                    syntax. Conditional blocks use{" "}
                    <code className="rounded bg-zoru-surface-2 px-1 text-xs">
                      {"{% if x %}…{% endif %}"}
                    </code>
                    .
                  </ZoruCardDescription>
                </div>
                <Badge
                  variant={
                    vm.status === "approved"
                      ? "default"
                      : vm.status === "submitted"
                        ? "secondary"
                        : vm.status === "rejected"
                          ? "destructive"
                          : "outline"
                  }
                >
                  {vm.status}
                </Badge>
              </div>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name">Name</Label>
                  <Input
                    id="tpl-name"
                    value={vm.name}
                    onChange={(e) => setVm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="otp-login-en"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-category">Category</Label>
                  <Select
                    value={vm.category}
                    onValueChange={(v) =>
                      setVm((p) => ({
                        ...p,
                        category: v as SabsmsTemplateCategory,
                      }))
                    }
                  >
                    <ZoruSelectTrigger id="tpl-category">
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <ZoruSelectItem key={c} value={c}>
                          {c}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>
              </div>

              {/* Locale switcher — segmented buttons (no ZoruTabs) */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-zoru-ink">Locale</div>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-zoru-line bg-zoru-surface-2 p-1">
                  {SUPPORTED_LOCALES.map((l) => {
                    const has = vm.bodies.some((b) => b.locale === l.code);
                    const active = activeLocale === l.code;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setActiveLocale(l.code);
                          if (!has) setBodyForLocale(l.code, "");
                        }}
                        className={
                          "group inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors " +
                          (active
                            ? "bg-white text-zoru-ink shadow-sm border border-zoru-line"
                            : "text-zoru-ink hover:bg-white/60")
                        }
                      >
                        <span className="font-medium uppercase tracking-wide">
                          {l.code}
                        </span>
                        <span className="hidden text-zoru-ink-muted sm:inline">
                          {l.label}
                        </span>
                        {has && active && vm.bodies.length > 1 && (
                          <span
                            role="button"
                            aria-label={`Remove ${l.code}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLocale(l.code);
                            }}
                            className="ml-1 rounded p-0.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`tpl-body-${activeLocale}`}>
                    Body — {activeLocale}
                  </Label>
                  <Popover open={varsHelpOpen} onOpenChange={setVarsHelpOpen}>
                    <ZoruPopoverTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Variables &amp; helpers
                      </Button>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent className="w-80 space-y-3 text-sm">
                      <div>
                        <div className="mb-1 font-medium">Date snippets</div>
                        <div className="flex flex-col gap-1">
                          {DATE_SNIPPETS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded bg-zoru-surface-2 px-2 py-1 text-left font-mono text-xs hover:bg-zoru-surface-2"
                              onClick={() => {
                                insertSnippet(s);
                                setVarsHelpOpen(false);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <div className="mb-1 font-medium">Conditional block</div>
                        <button
                          type="button"
                          className="w-full rounded bg-zoru-surface-2 px-2 py-1 text-left font-mono text-xs hover:bg-zoru-surface-2"
                          onClick={() => {
                            insertSnippet("{% if name %}Hi {{ name }}{% endif %}");
                            setVarsHelpOpen(false);
                          }}
                        >
                          {"{% if name %}…{% endif %}"}
                        </button>
                      </div>
                    </ZoruPopoverContent>
                  </Popover>
                </div>
                <div className="relative">
                  <Textarea
                    id={`tpl-body-${activeLocale}`}
                    ref={textareaRef}
                    rows={8}
                    value={activeBody}
                    onChange={handleBodyChange}
                    placeholder="Hi {{ first_name }}, your OTP is {{ code }}."
                    className="font-mono text-sm"
                  />
                  {varSuggestOpen && detectedVars.length > 0 && (
                    <div className="absolute right-2 top-2 z-10 w-48 rounded-md border border-zoru-line bg-white p-1 text-xs shadow-md">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-zoru-ink">
                        Insert variable
                      </div>
                      {detectedVars.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="block w-full rounded px-2 py-1 text-left font-mono hover:bg-zoru-surface-2"
                          onClick={() => insertVar(v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <AiRewriteToolbar
                currentBody={activeBody}
                onApply={(next) => setBodyForLocale(activeLocale, next)}
                onApplyTranslation={(locale, body) => setBodyForLocale(locale, body)}
              />
            </ZoruCardContent>
          </Card>

          {/* Variable defaults */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Variable defaults</ZoruCardTitle>
              <ZoruCardDescription>
                Used when a recipient is missing a value. The engine
                falls back to the empty string if no default is set.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              {vm.variableDefaults.length === 0 && (
                <p className="text-xs text-zoru-ink">
                  Type{" "}
                  <code className="rounded bg-zoru-surface-2 px-1">
                    {"{{ var_name }}"}
                  </code>{" "}
                  in the body — variables appear here automatically.
                </p>
              )}
              {vm.variableDefaults.map((v, i) => (
                <div
                  key={v.name + i}
                  className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2"
                >
                  <Input
                    value={v.name}
                    onChange={(e) =>
                      setVm((p) => {
                        const next = p.variableDefaults.slice();
                        next[i] = { ...v, name: e.target.value };
                        return { ...p, variableDefaults: next };
                      })
                    }
                    className="font-mono text-xs"
                  />
                  <Input
                    value={v.defaultValue}
                    onChange={(e) =>
                      setVm((p) => {
                        const next = p.variableDefaults.slice();
                        next[i] = { ...v, defaultValue: e.target.value };
                        return { ...p, variableDefaults: next };
                      })
                    }
                    placeholder="default value"
                    className="text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setVm((p) => ({
                        ...p,
                        variableDefaults: p.variableDefaults.filter(
                          (_, j) => j !== i,
                        ),
                      }))
                    }
                    aria-label={`Remove ${v.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setVm((p) => ({
                    ...p,
                    variableDefaults: [
                      ...p.variableDefaults,
                      { name: "", defaultValue: "" },
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add variable
              </Button>
            </ZoruCardContent>
          </Card>

          {/* Carrier-registration forms */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>India DLT</ZoruCardTitle>
                <ZoruCardDescription>
                  Required for traffic terminating in India.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-3">
                <DltField
                  label="Principal Entity ID (PEID)"
                  value={vm.metadata.dlt.principalEntityId}
                  onChange={(v) =>
                    setVm((p) => ({
                      ...p,
                      metadata: {
                        ...p.metadata,
                        dlt: { ...p.metadata.dlt, principalEntityId: v },
                      },
                    }))
                  }
                />
                <DltField
                  label="Content template ID"
                  value={vm.metadata.dlt.templateId}
                  onChange={(v) =>
                    setVm((p) => ({
                      ...p,
                      metadata: {
                        ...p.metadata,
                        dlt: { ...p.metadata.dlt, templateId: v },
                      },
                    }))
                  }
                />
                <DltField
                  label="Header ID"
                  value={vm.metadata.dlt.headerId}
                  onChange={(v) =>
                    setVm((p) => ({
                      ...p,
                      metadata: {
                        ...p.metadata,
                        dlt: { ...p.metadata.dlt, headerId: v },
                      },
                    }))
                  }
                />
                <div className="space-y-1.5">
                  <Label>Content category</Label>
                  <Select
                    value={vm.metadata.dlt.contentCategory}
                    onValueChange={(v) =>
                      setVm((p) => ({
                        ...p,
                        metadata: {
                          ...p.metadata,
                          dlt: { ...p.metadata.dlt, contentCategory: v },
                        },
                      }))
                    }
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Select category" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="promotional">
                        Promotional
                      </ZoruSelectItem>
                      <ZoruSelectItem value="transactional">
                        Transactional
                      </ZoruSelectItem>
                      <ZoruSelectItem value="service-implicit">
                        Service — implicit
                      </ZoruSelectItem>
                      <ZoruSelectItem value="service-explicit">
                        Service — explicit
                      </ZoruSelectItem>
                    </ZoruSelectContent>
                  </Select>
                </div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>US 10DLC</ZoruCardTitle>
                <ZoruCardDescription>
                  Required for A2P traffic terminating in the US.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent className="space-y-3">
                <DltField
                  label="Brand ID"
                  value={vm.metadata.tendlc.brandId}
                  onChange={(v) =>
                    setVm((p) => ({
                      ...p,
                      metadata: {
                        ...p.metadata,
                        tendlc: { ...p.metadata.tendlc, brandId: v },
                      },
                    }))
                  }
                />
                <DltField
                  label="Campaign ID"
                  value={vm.metadata.tendlc.campaignId}
                  onChange={(v) =>
                    setVm((p) => ({
                      ...p,
                      metadata: {
                        ...p.metadata,
                        tendlc: { ...p.metadata.tendlc, campaignId: v },
                      },
                    }))
                  }
                />
                <div className="space-y-1.5">
                  <Label>Use case</Label>
                  <Select
                    value={vm.metadata.tendlc.useCase}
                    onValueChange={(v) =>
                      setVm((p) => ({
                        ...p,
                        metadata: {
                          ...p.metadata,
                          tendlc: { ...p.metadata.tendlc, useCase: v },
                        },
                      }))
                    }
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Select use case" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="2fa">
                        2FA / OTP
                      </ZoruSelectItem>
                      <ZoruSelectItem value="account_notification">
                        Account notification
                      </ZoruSelectItem>
                      <ZoruSelectItem value="marketing">
                        Marketing
                      </ZoruSelectItem>
                      <ZoruSelectItem value="customer_care">
                        Customer care
                      </ZoruSelectItem>
                      <ZoruSelectItem value="delivery_notification">
                        Delivery notification
                      </ZoruSelectItem>
                    </ZoruSelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sample messages</Label>
                  <Textarea
                    rows={3}
                    value={vm.metadata.tendlc.sampleMessages.join("\n")}
                    onChange={(e) =>
                      setVm((p) => ({
                        ...p,
                        metadata: {
                          ...p.metadata,
                          tendlc: {
                            ...p.metadata.tendlc,
                            sampleMessages: e.target.value.split("\n"),
                          },
                        },
                      }))
                    }
                    placeholder="One sample per line"
                    className="text-xs"
                  />
                </div>
              </ZoruCardContent>
            </Card>
          </div>

          {/* Per-template settings */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Send-time policy</ZoruCardTitle>
              <ZoruCardDescription>
                Applied to every send that uses this template.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <PolicyRow
                title="Auto-wrap links"
                desc="Rewrite URLs in the body to workspace short-links for click tracking."
                checked={vm.metadata.tendlc.autoLinkWrap}
                onChange={(checked) =>
                  setVm((p) => ({
                    ...p,
                    metadata: {
                      ...p.metadata,
                      tendlc: { ...p.metadata.tendlc, autoLinkWrap: checked },
                    },
                  }))
                }
              />
              <PolicyRow
                title="Footer policy injection"
                desc='Append "Reply STOP to unsubscribe" to every send.'
                checked={vm.metadata.tendlc.footerInjection}
                onChange={(checked) =>
                  setVm((p) => ({
                    ...p,
                    metadata: {
                      ...p.metadata,
                      tendlc: { ...p.metadata.tendlc, footerInjection: checked },
                    },
                  }))
                }
              />
            </ZoruCardContent>
          </Card>

          {/* Approval */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Approval</ZoruCardTitle>
              <ZoruCardDescription>
                Submitting moves the template to the reviewer queue.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <Label htmlFor="reviewer-notes">Reviewer notes</Label>
              <Textarea
                id="reviewer-notes"
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Why this template, what changed, links to spec…"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleSubmitForApproval}
                  disabled={pending}
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Submit for approval
                </Button>
                {vm.status === "submitted" && (
                  <Button
                    variant="ghost"
                    onClick={handleWithdraw}
                    disabled={pending}
                  >
                    Withdraw
                  </Button>
                )}
                <Button variant="ghost" asChild>
                  <Link href="/sabsms/templates/approvals">
                    Reviewer inbox
                  </Link>
                </Button>
                <p className="text-[11px] text-zoru-ink">
                  TODO: <code>/sabsms/templates/approvals</code> ships
                  with Phase 11.
                </p>
              </div>
            </ZoruCardContent>
          </Card>
        </div>

        {/* ── Right column — preview + toolbar ──────────────────────── */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Test Payload</ZoruCardTitle>
                <ZoruCardDescription>
                  Supply JSON to test variable rendering.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <Textarea
                  value={payloadJson}
                  onChange={(e) => setPayloadJson(e.target.value)}
                  className="font-mono text-xs"
                  rows={6}
                />
              </ZoruCardContent>
            </Card>

            <TemplatePreview
              body={activeBody}
              category={vm.category}
              variableDefaults={vm.variableDefaults}
              sampleVars={sampleVars}
              metadata={vm.metadata}
            />

            <div className="rounded border border-zoru-line bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleSave} disabled={pending}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {pending ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePublish}
                  disabled={pending}
                >
                  <SendHorizontal className="mr-1.5 h-4 w-4" />
                  Publish
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="mr-1.5 h-3.5 w-3.5" />
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openDiff}
                >
                  <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                  Diff vs published
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPiiOpen(true)}
                >
                  PII scrub preview
                </Button>
                <SabsmsKbdHint
                  shortcuts={[
                    { keys: ["Cmd", "S"], description: "Save draft" },
                    { keys: ["Cmd", "Enter"], description: "Publish" },
                    { keys: ["Cmd", "/"], description: "Show variables panel" },
                  ]}
                />
              </div>
              {error && (
                <p className="rounded border border-zoru-line bg-zoru-surface-2 p-2 text-xs text-zoru-ink">
                  {error}
                </p>
              )}
              {info && !error && (
                <p className="rounded border border-zoru-line bg-zoru-surface-2 p-2 text-xs text-zoru-ink">
                  {info}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Diff drawer (#18) ─────────────────────────────────────── */}
      <SabsmsDetailDrawer
        open={diffOpen}
        onOpenChange={setDiffOpen}
        title="Diff vs last published"
        description={`Locale: ${activeLocale}`}
      >
        {diffData === null ? (
          <p className="text-sm text-zoru-ink">Computing diff…</p>
        ) : !diffData.ok ? (
          <p className="text-sm text-zoru-ink">{diffData.error}</p>
        ) : !diffData.hasPrevious ? (
          <p className="text-sm text-zoru-ink">
            No published version yet — publish once to enable diffs.
          </p>
        ) : (
          <div className="rounded border border-zoru-line bg-zoru-surface-2 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diffData.segments.map((s, i) => {
              if (s.kind === "same") return <span key={i}>{s.text}</span>;
              if (s.kind === "ins")
                return (
                  <ins
                    key={i}
                    className="bg-zoru-surface-2 text-zoru-ink no-underline"
                  >
                    {s.text}
                  </ins>
                );
              return (
                <del key={i} className="bg-zoru-surface-2 text-zoru-ink">
                  {s.text}
                </del>
              );
            })}
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* ── Version history drawer ─────────────────────────────────────── */}
      <SabsmsDetailDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Version history"
        description="View past saves and restore bodies & variables."
      >
        <div className="space-y-4">
          {!vm.history || vm.history.length === 0 ? (
            <p className="text-sm text-zoru-ink">No version history yet.</p>
          ) : (
            vm.history.map((entry) => (
              <div
                key={entry.id}
                className="rounded border border-zoru-line bg-white p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {formatUTC(entry.timestamp, true)}
                  </div>
                  <Badge variant="outline">{entry.status}</Badge>
                </div>
                <div className="text-xs text-zoru-ink">
                  {entry.bodies.length} locale(s), {entry.variableDefaults.length} variable(s)
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setVm((p) => ({
                      ...p,
                      bodies: entry.bodies,
                      variableDefaults: entry.variableDefaults,
                    }));
                    setHistoryOpen(false);
                  }}
                >
                  Restore this version
                </Button>
              </div>
            ))
          )}
        </div>
      </SabsmsDetailDrawer>

      {/* ── PII scrub preview drawer (#14) ────────────────────────── */}
      <SabsmsDetailDrawer
        open={piiOpen}
        onOpenChange={setPiiOpen}
        title="PII scrub preview"
        description="What the AI prompt would look like with phones and emails redacted."
      >
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-zoru-ink">
              Original
            </div>
            <pre className="rounded border border-zoru-line bg-zoru-surface-2 p-3 whitespace-pre-wrap text-xs">
              {activeBody || "(empty)"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-zoru-ink">
              After scrub
            </div>
            <pre className="rounded border border-zoru-line bg-zoru-surface-2 p-3 whitespace-pre-wrap text-xs">
              {piiScrub(activeBody) || "(empty)"}
            </pre>
          </div>
          <p className="text-[11px] text-zoru-ink">
            Phones (E.164-ish) and emails are masked before any AI
            prompt leaves the workspace.
          </p>
        </div>
      </SabsmsDetailDrawer>
    </div>
  );
}

function DltField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  );
}

function PolicyRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} />
      <div className="flex-1">
        <div className="text-sm font-medium text-zoru-ink">{title}</div>
        <div className="text-xs text-zoru-ink">{desc}</div>
      </div>
    </label>
  );
}
