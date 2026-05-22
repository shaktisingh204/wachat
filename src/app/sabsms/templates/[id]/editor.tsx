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
  CalendarClock,
  GitCompareArrows,
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
  const [sampleOpen, setSampleOpen] = useState(false);
  const [varsHelpOpen, setVarsHelpOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState<DiffActionResult | null>(null);
  const [piiOpen, setPiiOpen] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState(initial.reviewerNotes);
  const [sampleVars, setSampleVars] = useState<Record<string, string>>({});
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
          <ZoruCard>
            <ZoruCardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <ZoruCardTitle>Template</ZoruCardTitle>
                  <ZoruCardDescription>
                    Variables use{" "}
                    <code className="rounded bg-slate-100 px-1 text-xs">
                      {"{{ name }}"}
                    </code>{" "}
                    syntax. Conditional blocks use{" "}
                    <code className="rounded bg-slate-100 px-1 text-xs">
                      {"{% if x %}…{% endif %}"}
                    </code>
                    .
                  </ZoruCardDescription>
                </div>
                <ZoruBadge
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
                </ZoruBadge>
              </div>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="tpl-name">Name</ZoruLabel>
                  <ZoruInput
                    id="tpl-name"
                    value={vm.name}
                    onChange={(e) => setVm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="otp-login-en"
                  />
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel htmlFor="tpl-category">Category</ZoruLabel>
                  <ZoruSelect
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
                  </ZoruSelect>
                </div>
              </div>

              {/* Locale switcher — segmented buttons (no ZoruTabs) */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-600">Locale</div>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1">
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
                            ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                            : "text-slate-600 hover:bg-white/60")
                        }
                      >
                        <span className="font-medium uppercase tracking-wide">
                          {l.code}
                        </span>
                        <span className="hidden text-slate-400 sm:inline">
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
                            className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
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
                  <ZoruLabel htmlFor={`tpl-body-${activeLocale}`}>
                    Body — {activeLocale}
                  </ZoruLabel>
                  <ZoruPopover open={varsHelpOpen} onOpenChange={setVarsHelpOpen}>
                    <ZoruPopoverTrigger asChild>
                      <ZoruButton variant="ghost" size="sm">
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Variables &amp; helpers
                      </ZoruButton>
                    </ZoruPopoverTrigger>
                    <ZoruPopoverContent className="w-80 space-y-3 text-sm">
                      <div>
                        <div className="mb-1 font-medium">Date snippets</div>
                        <div className="flex flex-col gap-1">
                          {DATE_SNIPPETS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded bg-slate-100 px-2 py-1 text-left font-mono text-xs hover:bg-slate-200"
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
                      <ZoruSeparator />
                      <div>
                        <div className="mb-1 font-medium">Conditional block</div>
                        <button
                          type="button"
                          className="w-full rounded bg-slate-100 px-2 py-1 text-left font-mono text-xs hover:bg-slate-200"
                          onClick={() => {
                            insertSnippet("{% if name %}Hi {{ name }}{% endif %}");
                            setVarsHelpOpen(false);
                          }}
                        >
                          {"{% if name %}…{% endif %}"}
                        </button>
                      </div>
                    </ZoruPopoverContent>
                  </ZoruPopover>
                </div>
                <div className="relative">
                  <ZoruTextarea
                    id={`tpl-body-${activeLocale}`}
                    ref={textareaRef}
                    rows={8}
                    value={activeBody}
                    onChange={handleBodyChange}
                    placeholder="Hi {{ first_name }}, your OTP is {{ code }}."
                    className="font-mono text-sm"
                  />
                  {varSuggestOpen && detectedVars.length > 0 && (
                    <div className="absolute right-2 top-2 z-10 w-48 rounded-md border border-slate-200 bg-white p-1 text-xs shadow-md">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
                        Insert variable
                      </div>
                      {detectedVars.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="block w-full rounded px-2 py-1 text-left font-mono hover:bg-slate-100"
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
          </ZoruCard>

          {/* Variable defaults */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Variable defaults</ZoruCardTitle>
              <ZoruCardDescription>
                Used when a recipient is missing a value. The engine
                falls back to the empty string if no default is set.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              {vm.variableDefaults.length === 0 && (
                <p className="text-xs text-slate-500">
                  Type{" "}
                  <code className="rounded bg-slate-100 px-1">
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
                  <ZoruInput
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
                  <ZoruInput
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
                  <ZoruButton
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
                  </ZoruButton>
                </div>
              ))}
              <ZoruButton
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
              </ZoruButton>
            </ZoruCardContent>
          </ZoruCard>

          {/* Carrier-registration forms */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ZoruCard>
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
                  <ZoruLabel>Content category</ZoruLabel>
                  <ZoruSelect
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
                  </ZoruSelect>
                </div>
              </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
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
                  <ZoruLabel>Use case</ZoruLabel>
                  <ZoruSelect
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
                  </ZoruSelect>
                </div>
                <div className="space-y-1.5">
                  <ZoruLabel>Sample messages</ZoruLabel>
                  <ZoruTextarea
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
            </ZoruCard>
          </div>

          {/* Per-template settings */}
          <ZoruCard>
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
          </ZoruCard>

          {/* Approval */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Approval</ZoruCardTitle>
              <ZoruCardDescription>
                Submitting moves the template to the reviewer queue.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              <ZoruLabel htmlFor="reviewer-notes">Reviewer notes</ZoruLabel>
              <ZoruTextarea
                id="reviewer-notes"
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Why this template, what changed, links to spec…"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <ZoruButton
                  variant="outline"
                  onClick={handleSubmitForApproval}
                  disabled={pending}
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Submit for approval
                </ZoruButton>
                {vm.status === "submitted" && (
                  <ZoruButton
                    variant="ghost"
                    onClick={handleWithdraw}
                    disabled={pending}
                  >
                    Withdraw
                  </ZoruButton>
                )}
                <ZoruButton variant="ghost" asChild>
                  <Link href="/sabsms/templates/approvals">
                    Reviewer inbox
                  </Link>
                </ZoruButton>
                <p className="text-[11px] text-slate-500">
                  TODO: <code>/sabsms/templates/approvals</code> ships
                  with Phase 11.
                </p>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </div>

        {/* ── Right column — preview + toolbar ──────────────────────── */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">
            <TemplatePreview
              body={activeBody}
              category={vm.category}
              variableDefaults={vm.variableDefaults}
              sampleVars={sampleVars}
              metadata={vm.metadata}
            />

            <div className="rounded border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ZoruButton onClick={handleSave} disabled={pending}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {pending ? "Saving…" : "Save draft"}
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  onClick={handlePublish}
                  disabled={pending}
                >
                  <SendHorizontal className="mr-1.5 h-4 w-4" />
                  Publish
                </ZoruButton>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSampleOpen(true)}
                >
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                  Test with contact
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={openDiff}
                >
                  <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                  Diff vs published
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setPiiOpen(true)}
                >
                  PII scrub preview
                </ZoruButton>
                <SabsmsKbdHint
                  shortcuts={[
                    { keys: ["Cmd", "S"], description: "Save draft" },
                    { keys: ["Cmd", "Enter"], description: "Publish" },
                    { keys: ["Cmd", "/"], description: "Show variables panel" },
                  ]}
                />
              </div>
              {error && (
                <p className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  {error}
                </p>
              )}
              {info && !error && (
                <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                  {info}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Test with contact dialog (#8) ─────────────────────────── */}
      <ZoruDialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Test with a sample contact</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set values for each variable and watch the preview update
              live. These values aren&rsquo;t persisted.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            {detectedVars.length === 0 && (
              <p className="text-sm text-slate-500">
                This template has no variables yet.
              </p>
            )}
            {detectedVars.map((v) => (
              <div key={v} className="space-y-1">
                <ZoruLabel htmlFor={`sample-${v}`}>{v}</ZoruLabel>
                <ZoruInput
                  id={`sample-${v}`}
                  value={sampleVars[v] ?? ""}
                  onChange={(e) =>
                    setSampleVars((p) => ({ ...p, [v]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Diff drawer (#18) ─────────────────────────────────────── */}
      <SabsmsDetailDrawer
        open={diffOpen}
        onOpenChange={setDiffOpen}
        title="Diff vs last published"
        description={`Locale: ${activeLocale}`}
      >
        {diffData === null ? (
          <p className="text-sm text-slate-500">Computing diff…</p>
        ) : !diffData.ok ? (
          <p className="text-sm text-rose-600">{diffData.error}</p>
        ) : !diffData.hasPrevious ? (
          <p className="text-sm text-slate-500">
            No published version yet — publish once to enable diffs.
          </p>
        ) : (
          <div className="rounded border border-slate-200 bg-slate-50 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diffData.segments.map((s, i) => {
              if (s.kind === "same") return <span key={i}>{s.text}</span>;
              if (s.kind === "ins")
                return (
                  <ins
                    key={i}
                    className="bg-emerald-100 text-emerald-900 no-underline"
                  >
                    {s.text}
                  </ins>
                );
              return (
                <del key={i} className="bg-rose-100 text-rose-900">
                  {s.text}
                </del>
              );
            })}
          </div>
        )}
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
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
              Original
            </div>
            <pre className="rounded border border-slate-200 bg-slate-50 p-3 whitespace-pre-wrap text-xs">
              {activeBody || "(empty)"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
              After scrub
            </div>
            <pre className="rounded border border-emerald-200 bg-emerald-50 p-3 whitespace-pre-wrap text-xs">
              {piiScrub(activeBody) || "(empty)"}
            </pre>
          </div>
          <p className="text-[11px] text-slate-500">
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
      <ZoruLabel>{label}</ZoruLabel>
      <ZoruInput
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
      <ZoruSwitch checked={checked} onCheckedChange={onChange} />
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </label>
  );
}
