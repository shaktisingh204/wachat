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
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from "@/components/sabcrm/20ui";
import { SabsmsDetailDrawer, SabsmsKbdHint } from "@/components/sabsms/page-toolkit";
import { formatUTC } from "@/lib/utils";

import { AiRewriteToolbar } from "./ai-rewrite";
import { DltScrubPanel, type DltBindingRegistry } from "./dlt-scrub-panel";
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

const EMPTY_DLT_REGISTRY: DltBindingRegistry = { templates: [], headers: [] };

export interface TemplateEditorProps {
  initial: TemplateEditorViewModel;
  /** Indicates `id === "new"`. */
  isNew: boolean;
  /** Workspace DLT registry (V2.8) — drives the live scrub card. */
  dltRegistry?: DltBindingRegistry;
}

export function TemplateEditor({
  initial,
  isNew,
  dltRegistry = EMPTY_DLT_REGISTRY,
}: TemplateEditorProps) {
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

  // Keep `variableDefaults` in step with the variables we've detected.
  // Add stubs for any new var name we just saw, drop entries the user
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
        setInfo("Withdrawn, back to draft");
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

  // Variable autocomplete: toggle a popover when the user is typing
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
        {/* Left column: primary editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Template</CardTitle>
                  <CardDescription>
                    Variables use{" "}
                    <code className="rounded bg-[var(--st-bg-secondary)] px-1 text-xs">
                      {"{{ name }}"}
                    </code>{" "}
                    syntax. Conditional blocks use{" "}
                    <code className="rounded bg-[var(--st-bg-secondary)] px-1 text-xs">
                      {"{% if x %}...{% endif %}"}
                    </code>
                    .
                  </CardDescription>
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
            </CardHeader>
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={vm.name}
                    onChange={(e) => setVm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="otp-login-en"
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={vm.category}
                    onValueChange={(v) =>
                      setVm((p) => ({
                        ...p,
                        category: v as SabsmsTemplateCategory,
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Locale switcher: segmented buttons */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--st-text)]">Locale</div>
                <div className="flex flex-wrap gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1">
                  {SUPPORTED_LOCALES.map((l) => {
                    const has = vm.bodies.some((b) => b.locale === l.code);
                    const active = activeLocale === l.code;
                    const canRemove = has && active && vm.bodies.length > 1;
                    return (
                      <div key={l.code} className="inline-flex items-center gap-0.5">
                        <Button
                          variant={active ? "secondary" : "ghost"}
                          size="sm"
                          aria-pressed={active}
                          onClick={() => {
                            setActiveLocale(l.code);
                            if (!has) setBodyForLocale(l.code, "");
                          }}
                        >
                          <span className="font-medium uppercase tracking-wide">
                            {l.code}
                          </span>
                          <span className="hidden text-[var(--st-text-secondary)] sm:inline">
                            {l.label}
                          </span>
                        </Button>
                        {canRemove ? (
                          <IconButton
                            label={`Remove ${l.code}`}
                            icon={X}
                            size="sm"
                            onClick={() => removeLocale(l.code)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Body textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`tpl-body-${activeLocale}`}>
                    Body, {activeLocale}
                  </Label>
                  <Popover open={varsHelpOpen} onOpenChange={setVarsHelpOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" iconLeft={Sparkles}>
                        Variables &amp; helpers
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 space-y-3 text-sm">
                      <div>
                        <div className="mb-1 font-medium">Date snippets</div>
                        <div className="flex flex-col gap-1">
                          {DATE_SNIPPETS.map((s) => (
                            <Button
                              key={s}
                              variant="ghost"
                              size="sm"
                              className="justify-start font-mono"
                              onClick={() => {
                                insertSnippet(s);
                                setVarsHelpOpen(false);
                              }}
                            >
                              {s}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <div className="mb-1 font-medium">Conditional block</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          block
                          className="justify-start font-mono"
                          onClick={() => {
                            insertSnippet("{% if name %}Hi {{ name }}{% endif %}");
                            setVarsHelpOpen(false);
                          }}
                        >
                          {"{% if name %}...{% endif %}"}
                        </Button>
                      </div>
                    </PopoverContent>
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
                    <div className="absolute right-2 top-2 z-10 w-48 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 text-xs shadow-md">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--st-text-secondary)]">
                        Insert variable
                      </div>
                      {detectedVars.map((v) => (
                        <Button
                          key={v}
                          variant="ghost"
                          size="sm"
                          block
                          className="justify-start font-mono"
                          onClick={() => insertVar(v)}
                        >
                          {v}
                        </Button>
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
            </CardBody>
          </Card>

          {/* Variable defaults */}
          <Card>
            <CardHeader>
              <CardTitle>Variable defaults</CardTitle>
              <CardDescription>
                Used when a recipient is missing a value. The engine
                falls back to the empty string if no default is set.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {vm.variableDefaults.length === 0 && (
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Type{" "}
                  <code className="rounded bg-[var(--st-bg-secondary)] px-1">
                    {"{{ var_name }}"}
                  </code>{" "}
                  in the body. Variables appear here automatically.
                </p>
              )}
              {vm.variableDefaults.map((v, i) => (
                <div
                  key={v.name + i}
                  className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2"
                >
                  <Input
                    aria-label={`Variable name ${i + 1}`}
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
                    aria-label={`Default value for ${v.name || `variable ${i + 1}`}`}
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
                  <IconButton
                    label={`Remove ${v.name || `variable ${i + 1}`}`}
                    icon={Trash2}
                    onClick={() =>
                      setVm((p) => ({
                        ...p,
                        variableDefaults: p.variableDefaults.filter(
                          (_, j) => j !== i,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                iconLeft={Plus}
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
                Add variable
              </Button>
            </CardBody>
          </Card>

          {/* Carrier-registration forms */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>India DLT</CardTitle>
                <CardDescription>
                  Required for traffic terminating in India.
                </CardDescription>
              </CardHeader>
              <CardBody className="space-y-3">
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
                <Field label="Content category">
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
                    <SelectTrigger aria-label="Content category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promotional">
                        Promotional
                      </SelectItem>
                      <SelectItem value="transactional">
                        Transactional
                      </SelectItem>
                      <SelectItem value="service-implicit">
                        Service, implicit
                      </SelectItem>
                      <SelectItem value="service-explicit">
                        Service, explicit
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>US 10DLC</CardTitle>
                <CardDescription>
                  Required for A2P traffic terminating in the US.
                </CardDescription>
              </CardHeader>
              <CardBody className="space-y-3">
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
                <Field label="Use case">
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
                    <SelectTrigger aria-label="Use case">
                      <SelectValue placeholder="Select use case" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2fa">
                        2FA / OTP
                      </SelectItem>
                      <SelectItem value="account_notification">
                        Account notification
                      </SelectItem>
                      <SelectItem value="marketing">
                        Marketing
                      </SelectItem>
                      <SelectItem value="customer_care">
                        Customer care
                      </SelectItem>
                      <SelectItem value="delivery_notification">
                        Delivery notification
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Sample messages">
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
                </Field>
              </CardBody>
            </Card>
          </div>

          {/* Per-template settings */}
          <Card>
            <CardHeader>
              <CardTitle>Send-time policy</CardTitle>
              <CardDescription>
                Applied to every send that uses this template.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
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
            </CardBody>
          </Card>

          {/* Approval */}
          <Card>
            <CardHeader>
              <CardTitle>Approval</CardTitle>
              <CardDescription>
                Submitting moves the template to the reviewer queue.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Reviewer notes">
                <Textarea
                  rows={3}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Why this template, what changed, links to spec."
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  iconLeft={ShieldCheck}
                  onClick={handleSubmitForApproval}
                  disabled={pending}
                >
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
                <Button
                  variant="ghost"
                  onClick={() => router.push("/sabsms/templates/approvals")}
                >
                  Reviewer inbox
                </Button>
                <p className="text-[11px] text-[var(--st-text-secondary)]">
                  TODO: <code>/sabsms/templates/approvals</code> ships
                  with Phase 11.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right column: preview + toolbar */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Payload</CardTitle>
                <CardDescription>
                  Supply JSON to test variable rendering.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <Field label="Payload JSON">
                  <Textarea
                    value={payloadJson}
                    onChange={(e) => setPayloadJson(e.target.value)}
                    className="font-mono text-xs"
                    rows={6}
                  />
                </Field>
              </CardBody>
            </Card>

            <TemplatePreview
              body={activeBody}
              category={vm.category}
              variableDefaults={vm.variableDefaults}
              sampleVars={sampleVars}
              metadata={vm.metadata}
            />

            {/* Live DLT scrub (V2.8) — shown when the workspace has DLT
                templates registered OR this template already carries
                DLT fields. */}
            {(dltRegistry.templates.length > 0 ||
              Boolean(
                vm.metadata.dlt.templateId ||
                  vm.metadata.dlt.headerId ||
                  vm.metadata.dlt.principalEntityId ||
                  vm.metadata.dlt.contentCategory,
              )) && (
              <DltScrubPanel
                registry={dltRegistry}
                body={activeBody}
                templateId={vm.metadata.dlt.templateId}
                headerId={vm.metadata.dlt.headerId}
                onBind={(patch) =>
                  setVm((p) => ({
                    ...p,
                    metadata: {
                      ...p.metadata,
                      dlt: { ...p.metadata.dlt, ...patch },
                    },
                  }))
                }
              />
            )}

            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  iconLeft={Save}
                  loading={pending}
                  onClick={handleSave}
                >
                  {pending ? "Saving" : "Save draft"}
                </Button>
                <Button
                  variant="outline"
                  iconLeft={SendHorizontal}
                  onClick={handlePublish}
                  disabled={pending}
                >
                  Publish
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={History}
                  onClick={() => setHistoryOpen(true)}
                >
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={GitCompareArrows}
                  onClick={openDiff}
                >
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
                <Alert tone="danger" title="Could not complete">
                  {error}
                </Alert>
              )}
              {info && !error && (
                <Alert tone="success">{info}</Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diff drawer (#18) */}
      <SabsmsDetailDrawer
        open={diffOpen}
        onOpenChange={setDiffOpen}
        title="Diff vs last published"
        description={`Locale: ${activeLocale}`}
      >
        {diffData === null ? (
          <p className="text-sm text-[var(--st-text-secondary)]">Computing diff.</p>
        ) : !diffData.ok ? (
          <p className="text-sm text-[var(--st-text-secondary)]">{diffData.error}</p>
        ) : !diffData.hasPrevious ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No published version yet. Publish once to enable diffs.
          </p>
        ) : (
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diffData.segments.map((s, i) => {
              if (s.kind === "same") return <span key={i}>{s.text}</span>;
              if (s.kind === "ins")
                return (
                  <ins
                    key={i}
                    className="bg-[var(--st-bg-muted)] text-[var(--st-status-ok)] no-underline"
                  >
                    {s.text}
                  </ins>
                );
              return (
                <del key={i} className="bg-[var(--st-danger-soft)] text-[var(--st-danger)]">
                  {s.text}
                </del>
              );
            })}
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Version history drawer */}
      <SabsmsDetailDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Version history"
        description="View past saves and restore bodies and variables."
      >
        <div className="space-y-4">
          {!vm.history || vm.history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No version history yet"
              description="Saved drafts and published versions will appear here."
            />
          ) : (
            vm.history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-[var(--st-text)]">
                    {formatUTC(entry.timestamp, true)}
                  </div>
                  <Badge variant="outline">{entry.status}</Badge>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  {entry.bodies.length} locale(s), {entry.variableDefaults.length} variable(s)
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  block
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

      {/* PII scrub preview drawer (#14) */}
      <SabsmsDetailDrawer
        open={piiOpen}
        onOpenChange={setPiiOpen}
        title="PII scrub preview"
        description="What the AI prompt would look like with phones and emails redacted."
      >
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-[var(--st-text-secondary)]">
              Original
            </div>
            <pre className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 whitespace-pre-wrap text-xs">
              {activeBody || "(empty)"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-[var(--st-text-secondary)]">
              After scrub
            </div>
            <pre className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 whitespace-pre-wrap text-xs">
              {piiScrub(activeBody) || "(empty)"}
            </pre>
          </div>
          <p className="text-[11px] text-[var(--st-text-secondary)]">
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
    <Field label={label}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </Field>
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
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--st-text)]">{title}</div>
        <div className="text-xs text-[var(--st-text-secondary)]">{desc}</div>
      </div>
    </label>
  );
}
