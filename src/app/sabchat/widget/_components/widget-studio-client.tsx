"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageSquare, Plus, Save, Send, X } from "lucide-react";

import {
  Button,
  Card,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFileUrlInput } from "@/components/sabfiles";
import {
  getWidgetConfig,
  saveWidgetConfig,
  type WidgetInboxRow,
} from "@/app/actions/sabchat-widget-config.actions";
import {
  NOTIFICATION_SOUNDS,
  type ProactiveTrigger,
  type WidgetConfig,
} from "@/lib/sabchat/widget-config";

export function WidgetStudioClient({
  inboxes,
  initialInboxId,
  initialConfig,
}: {
  inboxes: WidgetInboxRow[];
  initialInboxId: string | null;
  initialConfig: WidgetConfig;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [inboxId, setInboxId] = React.useState<string | null>(initialInboxId);
  const [cfg, setCfg] = React.useState<WidgetConfig>(initialConfig);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);

  const set = React.useCallback(
    <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) =>
      setCfg((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const addRule = () =>
    setCfg((p) => ({
      ...p,
      proactiveRules: [
        ...p.proactiveRules,
        { id: `r-${Date.now()}`, trigger: "time", value: "10", message: "" },
      ],
    }));
  const updateRule = (
    id: string,
    patch: Partial<{ trigger: ProactiveTrigger; value: string; message: string }>,
  ) =>
    setCfg((p) => ({
      ...p,
      proactiveRules: p.proactiveRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  const removeRule = (id: string) =>
    setCfg((p) => ({ ...p, proactiveRules: p.proactiveRules.filter((r) => r.id !== id) }));

  const switchInbox = async (id: string) => {
    setInboxId(id);
    const res = await getWidgetConfig(id);
    if (res) setCfg(res.config);
  };

  const save = async () => {
    if (!inboxId) return;
    setSaving(true);
    const res = await saveWidgetConfig(inboxId, cfg);
    setSaving(false);
    if (res.ok) {
      setSavedAt(Date.now());
      toast({ title: "Widget saved" });
    } else {
      toast({ title: "Could not save", description: res.error, variant: "destructive" });
    }
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.sabnode.io";
  const embed = inboxId
    ? `<script src="${origin}/api/sabchat/${inboxId}" async defer></script>`
    : "";

  if (!inboxId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-[var(--st-text-secondary)]" aria-hidden />
        <h1 className="text-lg font-semibold text-[var(--st-text)]">No website inbox yet</h1>
        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
          Create a Website inbox in Admin to customise and embed your chat widget.
        </p>
        <Button
          className="mt-4"
          variant="primary"
          size="sm"
          onClick={() => router.push("/sabchat/admin")}
        >
          Go to Admin
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Widget Studio</PageTitle>
          <PageDescription>
            Customise the embeddable chat widget and copy the install snippet.
          </PageDescription>
        </PageHeaderHeading>
        <div className="flex items-center gap-2">
          {inboxes.length > 1 ? (
            <select
              aria-label="Inbox"
              value={inboxId}
              onChange={(e) => void switchInbox(e.target.value)}
              className="rounded-md border border-[var(--st-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--st-text)]"
            >
              {inboxes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button variant="primary" size="sm" iconLeft={Save} loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Control panel */}
        <Card className="space-y-6 p-6">
          <Group title="Branding">
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Color theme" value={cfg.widgetColor} onChange={(v) => set("widgetColor", v)} />
              <ColorField label="Button color" value={cfg.buttonColor} onChange={(v) => set("buttonColor", v)} />
            </div>
            <Field label="Logo">
              <SabFileUrlInput
                accept="image"
                value={cfg.logoUrl}
                onChange={(v) => set("logoUrl", v)}
                placeholder="Pick or upload a logo"
                pickerTitle="Pick a widget logo"
              />
            </Field>
          </Group>

          <Group title="Content">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Greeting">
                <Input value={cfg.greeting} onChange={(e) => set("greeting", e.target.value)} />
              </Field>
              <ColorField label="Title color" value={cfg.titleColor} onChange={(v) => set("titleColor", v)} />
            </div>
            <Field label="Widget title">
              <Input value={cfg.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Team name">
              <Input value={cfg.teamName} onChange={(e) => set("teamName", e.target.value)} />
            </Field>
            <Field label="Reply-time line">
              <Input value={cfg.replyTime} onChange={(e) => set("replyTime", e.target.value)} />
            </Field>
            <Field label="Welcome message">
              <Input value={cfg.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} />
            </Field>
          </Group>

          <Group title="Shape & position">
            <div className="grid gap-4 sm:grid-cols-2">
              <RangeField
                label="Widget corners"
                value={cfg.widgetRadius}
                min={0}
                max={32}
                onChange={(v) => set("widgetRadius", v)}
              />
              <RangeField
                label="Button corners"
                value={cfg.buttonRadius}
                min={0}
                max={32}
                onChange={(v) => set("buttonRadius", v)}
              />
            </div>
            <Field label="Position">
              <div className="flex gap-2">
                {(["lower-left", "lower-right"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => set("position", p)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                      cfg.position === p
                        ? "border-[var(--st-primary,var(--st-accent))] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                        : "border-[var(--st-border)] text-[var(--st-text-secondary)]"
                    }`}
                  >
                    {p.replace("-", " ")}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Bottom margin (px)" value={cfg.bottomMargin} onChange={(v) => set("bottomMargin", v)} />
              <NumberField label="Side margin (px)" value={cfg.sideMargin} onChange={(v) => set("sideMargin", v)} />
            </div>
            <Field label="Notification sound">
              <select
                value={cfg.notificationSound}
                onChange={(e) => set("notificationSound", e.target.value)}
                className="w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 py-2 text-sm text-[var(--st-text)] capitalize"
              >
                {NOTIFICATION_SOUNDS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </Group>

          <Group title="Proactive messages">
            <p className="text-xs text-[var(--st-text-secondary)]">
              Auto-send a message based on visitor behaviour (e.g. after 20s, or
              on the pricing page).
            </p>
            {cfg.proactiveRules.map((r) => (
              <div
                key={r.id}
                className="space-y-2 rounded-md border border-[var(--st-border)] p-3"
              >
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Trigger"
                    value={r.trigger}
                    onChange={(e) =>
                      updateRule(r.id, { trigger: e.target.value as ProactiveTrigger })
                    }
                    className="rounded-md border border-[var(--st-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--st-text)]"
                  >
                    <option value="time">After time (s)</option>
                    <option value="url">On URL</option>
                    <option value="scroll">On scroll %</option>
                    <option value="exitIntent">Exit intent</option>
                  </select>
                  {r.trigger !== "exitIntent" ? (
                    <Input
                      value={r.value}
                      onChange={(e) => updateRule(r.id, { value: e.target.value })}
                      placeholder={
                        r.trigger === "time"
                          ? "20"
                          : r.trigger === "url"
                            ? "/pricing"
                            : "60"
                      }
                      className="w-28"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeRule(r.id)}
                    aria-label="Remove rule"
                    className="ml-auto grid h-8 w-8 place-items-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <Input
                  value={r.message}
                  onChange={(e) => updateRule(r.id, { message: e.target.value })}
                  placeholder="Message to show…"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" iconLeft={Plus} onClick={addRule}>
              Add rule
            </Button>
          </Group>

          <Group title="Install">
            <p className="text-xs text-[var(--st-text-secondary)]">
              Paste this just before <code>&lt;/body&gt;</code> on your site.
            </p>
            <div className="flex items-start gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-[var(--st-bg-muted)] p-3 text-[11px] text-[var(--st-text)]">
                {embed}
              </pre>
              <Button
                variant="outline"
                size="sm"
                iconLeft={copied ? Check : Copy}
                onClick={async () => {
                  await navigator.clipboard.writeText(embed);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </Group>

          {savedAt ? (
            <p className="text-xs text-[var(--st-status-ok)]">Saved.</p>
          ) : null}
        </Card>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Live preview
          </p>
          <WidgetPreview cfg={cfg} />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Preview (mirrors the embedded widget panel)
 * ──────────────────────────────────────────────────────────────────────── */

function WidgetPreview({ cfg }: { cfg: WidgetConfig }) {
  return (
    <div
      className="mx-auto w-[320px] overflow-hidden border border-[var(--st-border)] bg-white shadow-xl dark:bg-zinc-900"
      style={{ borderRadius: cfg.widgetRadius + 6 }}
    >
      {/* Header */}
      <div
        className="px-5 pb-8 pt-6"
        style={{
          background: `linear-gradient(135deg, ${cfg.widgetColor}, ${shade(cfg.widgetColor, -18)})`,
          color: cfg.titleColor,
        }}
      >
        {cfg.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cfg.logoUrl}
            alt="logo"
            className="mb-3 h-9 w-9 rounded-full bg-white/90 object-contain p-1"
          />
        ) : (
          <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-bold">
            {cfg.teamName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="text-2xl font-bold leading-tight">{cfg.greeting}</p>
        <p className="text-2xl font-bold leading-tight opacity-95">{cfg.title}</p>
      </div>

      {/* Cards */}
      <div className="-mt-4 space-y-3 px-3 pb-3">
        <div
          className="bg-white p-3 shadow-md dark:bg-zinc-800"
          style={{ borderRadius: cfg.widgetRadius }}
        >
          <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Recent message
          </p>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-800 dark:text-zinc-100">Asked for Email</p>
              <p className="truncate text-xs text-zinc-400">Mithila · 38m ago</p>
            </div>
          </div>
        </div>

        <button
          className="flex w-full items-center justify-between bg-white p-3 text-left shadow-md dark:bg-zinc-800"
          style={{ borderRadius: cfg.widgetRadius }}
        >
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Send us a message
            </p>
            <p className="text-xs text-zinc-400">{cfg.replyTime}</p>
          </div>
          <span
            className="grid h-8 w-8 place-items-center text-white"
            style={{ background: cfg.buttonColor, borderRadius: cfg.buttonRadius }}
          >
            <Send className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-1 flex-col items-center gap-0.5 py-2">
          <span
            className="h-1 w-6 rounded-full"
            style={{ background: cfg.buttonColor }}
          />
          <span className="text-xs font-medium" style={{ color: cfg.buttonColor }}>
            Home
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-0.5 py-2 text-zinc-400">
          <MessageSquare className="h-4 w-4" aria-hidden />
          <span className="text-xs">Messages</span>
        </div>
      </div>
    </div>
  );
}

/* ── small field helpers ───────────────────────────────────────────────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--st-text)]">{title}</h3>
      {children}
    </div>
  );
}

function ColorField({
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
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-[var(--st-border)] bg-transparent p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={9} />
      </div>
    </Field>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={`${label} · ${value}px`}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Field>
  );
}

/** Lighten/darken a hex colour by a percentage for the header gradient. */
function shade(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (c * percent) / 100)));
  const r = adj(parseInt(m[1], 16));
  const g = adj(parseInt(m[2], 16));
  const b = adj(parseInt(m[3], 16));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
