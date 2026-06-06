'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Table, TBody, Td, Th, THead, Tr, Textarea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn, useToast } from '@/components/sabcrm/20ui/compat';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Square,
  Upload,
  X,
  } from 'lucide-react';

/**
 * /sabwa/bulk — Bulk Sender wizard (ZoruUI).
 *
 * Per SABWA_PLAN.md §6 page 10 and §9 (anti-ban): a 4-step wizard
 *
 *   Audience → Compose → Review → Run
 *
 * with mandatory rate-limit, jitter and ToS-gate confirmations. Bulk-send on a
 * personal WhatsApp account is the #1 cause of bans, so the page is built
 * around guardrails first, then ergonomics.
 *
 * Migrated from shadcn `/ui/*` to ZoruUI. Visual swap only — server-action
 * surface, prop shapes and data flow are unchanged. Audience source uses a
 * segmented Button group instead of a Tabs/ZoruRadioGroup card matrix per the
 * no-tab-ui directive; stepper is the existing pattern from `connect/_client`.
 */

import * as React from 'react';
import Link from 'next/link';

import { Slider } from '@/components/sabcrm/20ui/compat';
import {
  SabFilePickerButton,
  type SabFilePick,
} from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { formatJid, useResolveJid } from '@/lib/sabwa/format-jid';
import { getSabwaLimits, type SabwaQuota } from '@/lib/sabwa/plan-limits';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import {
  useBulkCampaignsRaw,
  useTemplates,
} from '@/lib/sabwa/use-sabwa-data';
import type { SabwaTemplate } from '@/lib/sabwa/types';

// ─── Anti-ban dismissed flag ───────────────────────────────────────────────

const ANTIBAN_DISMISS_KEY = 'sabwa.bulk.antibanDismissed.v1';

// ─── Domain model ──────────────────────────────────────────────────────────

type AudienceSource = 'paste' | 'csv' | 'label' | 'group' | 'tag';

interface CsvRow {
  // Free-form columns; we map one of them to the phone column at config time.
  [header: string]: string;
}

interface AudienceState {
  source: AudienceSource;
  pasted: string;
  csv: {
    headers: string[];
    rows: CsvRow[];
    phoneColumn: string | null;
    firstNameColumn: string | null;
    customColumns: Record<string, string>; // custom1 → header
  };
  label: string | null;
  groupJid: string | null;
  tag: string | null;
}

interface ComposeState {
  templateId: string | null;
  body: string;
  media: SabFilePick | null;
  variantBody: string | null;
}

type RatePreset = 'safe' | 'normal' | 'aggressive';

interface SettingsState {
  perMinute: number;
  jitterSec: number;
  windowStartHour: number;
  windowEndHour: number;
  timezone: string;
  firstContactOnly: boolean;
  acceptedToS: boolean;
}

const RATE_PRESETS: Record<RatePreset, { perMinute: number; label: string }> = {
  safe: { perMinute: 8, label: 'Safe (8/min)' },
  normal: { perMinute: 15, label: 'Normal (15/min)' },
  aggressive: { perMinute: 30, label: 'Aggressive (30/min)' },
};

const STEPS = ['Audience', 'Compose', 'Review', 'Run'] as const;
type Step = (typeof STEPS)[number];

const AUDIENCE_OPTIONS: { value: AudienceSource; label: string }[] = [
  { value: 'paste', label: 'Paste numbers' },
  { value: 'csv', label: 'Upload CSV' },
  { value: 'label', label: 'Use a label' },
  { value: 'group', label: 'Group members' },
  { value: 'tag', label: 'Contact tag' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function quotaCap(q: SabwaQuota, fallback: number): number {
  if (q === 'unlimited' || q === 'custom') return fallback;
  return q;
}

function parsePasted(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^\+?\d{6,15}$/.test(s.replace(/\D/g, '')) && s.length > 0)
    .map((s) => s.replace(/\D/g, ''));
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string): string[] =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = splitLine(lines[0]!);
  const rows: CsvRow[] = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
  return { headers, rows };
}

function getRecipientsFromAudience(a: AudienceState): string[] {
  if (a.source === 'paste') return parsePasted(a.pasted);
  if (a.source === 'csv') {
    if (!a.csv.phoneColumn) return [];
    return a.csv.rows
      .map((r) => (r[a.csv.phoneColumn as string] ?? '').replace(/\D/g, ''))
      .filter((s) => s.length >= 6 && s.length <= 15);
  }
  // label / group / tag are stub-only without engine wiring — return a
  // deterministic mock set sized off the chosen value so the rest of the
  // wizard remains exercisable.
  if (a.source === 'label' && a.label)
    return Array.from({ length: 42 }, (_, i) => `9100000${i.toString().padStart(4, '0')}`);
  if (a.source === 'group' && a.groupJid)
    return Array.from({ length: 87 }, (_, i) => `9111111${i.toString().padStart(4, '0')}`);
  if (a.source === 'tag' && a.tag)
    return Array.from({ length: 23 }, (_, i) => `9122222${i.toString().padStart(4, '0')}`);
  return [];
}

function substitute(body: string, row: CsvRow | undefined): string {
  if (!row) return body;
  return body.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => {
    return row[key] ?? `{{${key}}}`;
  });
}

function computeBanRisk({
  perMinute,
  recipientCount,
  firstContactRatio,
  jitterSec,
}: {
  perMinute: number;
  recipientCount: number;
  firstContactRatio: number;
  jitterSec: number;
}): { score: number; label: 'low' | 'moderate' | 'high' | 'critical' } {
  // 0..100 — bigger is worse. Weighted across rate, volume, first-contact ratio
  // and inverse-jitter.
  const rate = Math.min(perMinute / 30, 1) * 35;
  const volume = Math.min(recipientCount / 5000, 1) * 30;
  const first = firstContactRatio * 25;
  const jitter = (1 - Math.min(jitterSec / 10, 1)) * 10;
  const score = Math.round(rate + volume + first + jitter);
  let label: 'low' | 'moderate' | 'high' | 'critical' = 'low';
  if (score >= 70) label = 'critical';
  else if (score >= 50) label = 'high';
  else if (score >= 30) label = 'moderate';
  return { score, label };
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

// ─── Stepper ───────────────────────────────────────────────────────────────

interface StepperProps {
  current: number;
  onJump: (idx: number) => void;
  furthestUnlocked: number;
}

function Stepper({ current, onJump, furthestUnlocked }: StepperProps) {
  return (
    <ol
      className="grid grid-cols-1 gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 sm:grid-cols-4"
      aria-label="Wizard steps"
    >
      {STEPS.map((label, idx) => {
        const isActive = idx === current;
        const isComplete = idx < current;
        const isReachable = idx <= furthestUnlocked;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => isReachable && onJump(idx)}
              disabled={!isReachable}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-[var(--st-radius)] px-3 py-2 text-left text-[12.5px] transition',
                isActive && 'bg-[var(--st-text)] text-[var(--st-text-inverted)]',
                !isActive && isComplete && 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
                !isActive && !isComplete && 'text-[var(--st-text-secondary)]',
                !isReachable && 'opacity-50',
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold',
                  isActive && 'bg-[var(--st-text-inverted)] text-[var(--st-text)]',
                  !isActive && isComplete && 'bg-[var(--st-text)] text-[var(--st-text-inverted)]',
                  !isActive && !isComplete && 'border border-[var(--st-border-strong)] text-[var(--st-text-secondary)]',
                )}
              >
                {isComplete ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              <span className="truncate font-medium">{label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 text-[var(--st-text-secondary)] sm:hidden"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step 1 — Audience ─────────────────────────────────────────────────────

interface Step1Props {
  state: AudienceState;
  onChange: (next: AudienceState) => void;
  recipientCount: number;
  maxRecipients: number;
}

function Step1Audience({
  state,
  onChange,
  recipientCount,
  maxRecipients,
}: Step1Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const exceeded = recipientCount > maxRecipients;

  const handleCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsv(text);
      const phoneGuess =
        parsed.headers.find((h) => /phone|number|mobile|msisdn/i.test(h)) ??
        parsed.headers[0] ??
        null;
      const nameGuess =
        parsed.headers.find((h) => /first.?name|fname|given/i.test(h)) ?? null;
      onChange({
        ...state,
        csv: {
          headers: parsed.headers,
          rows: parsed.rows,
          phoneColumn: phoneGuess,
          firstNameColumn: nameGuess,
          customColumns: {},
        },
      });
    };
    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audience</CardTitle>
        <CardDescription>
          Pick who receives this campaign. You need at least 1 recipient, and
          no more than {maxRecipients.toLocaleString()} per your plan.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Segmented source switcher — replaces the old radio-card grid */}
        <div
          role="group"
          aria-label="Audience source"
          className="inline-flex flex-wrap gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
        >
          {AUDIENCE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={state.source === opt.value ? 'default' : 'ghost'}
              size="sm"
              className="rounded-[calc(var(--st-radius)-2px)]"
              onClick={() => onChange({ ...state, source: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {state.source === 'paste' && (
          <div className="space-y-2">
            <Label htmlFor="paste-numbers">Phone numbers</Label>
            <Textarea
              id="paste-numbers"
              placeholder={
                'One per line, or comma-separated\n919876543210\n919811112222'
              }
              value={state.pasted}
              onChange={(e) => onChange({ ...state, pasted: e.target.value })}
              rows={6}
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Country code required. Non-digit characters are stripped.
            </p>
          </div>
        )}

        {state.source === 'csv' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCsv(f);
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1"
              >
                <Upload className="h-3.5 w-3.5" />
                {state.csv.rows.length > 0
                  ? `${state.csv.rows.length} rows loaded`
                  : 'Choose CSV'}
              </Button>
              {state.csv.rows.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    onChange({
                      ...state,
                      csv: {
                        headers: [],
                        rows: [],
                        phoneColumn: null,
                        firstNameColumn: null,
                        customColumns: {},
                      },
                    })
                  }
                >
                  Clear
                </Button>
              )}
            </div>
            {state.csv.headers.length > 0 && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Phone column</Label>
                    <Select
                      value={state.csv.phoneColumn ?? ''}
                      onValueChange={(v) =>
                        onChange({
                          ...state,
                          csv: { ...state.csv, phoneColumn: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {state.csv.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">First-name column</Label>
                    <Select
                      value={state.csv.firstNameColumn ?? '__none__'}
                      onValueChange={(v) =>
                        onChange({
                          ...state,
                          csv: {
                            ...state.csv,
                            firstNameColumn: v === '__none__' ? null : v,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="(optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(none)</SelectItem>
                        {state.csv.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-[var(--st-radius)] border border-[var(--st-border)]">
                  <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--st-text)]">
                    Preview — first 5 rows
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <Tr>
                          {state.csv.headers.map((h) => (
                            <Th key={h} className="whitespace-nowrap">
                              {h}
                            </Th>
                          ))}
                        </Tr>
                      </THead>
                      <TBody>
                        {state.csv.rows.slice(0, 5).map((row, idx) => (
                          <Tr key={idx}>
                            {state.csv.headers.map((h) => (
                              <Td
                                key={h}
                                className="whitespace-nowrap text-xs"
                              >
                                {row[h] ?? ''}
                              </Td>
                            ))}
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {state.source === 'label' && (
          <div className="space-y-1">
            <Label>Label</Label>
            <Select
              value={state.label ?? ''}
              onValueChange={(v) => onChange({ ...state, label: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {state.source === 'group' && (
          <div className="space-y-1">
            <Label>Group</Label>
            <Select
              value={state.groupJid ?? ''}
              onValueChange={(v) => onChange({ ...state, groupJid: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="120363000000000001@g.us">
                  Family
                </SelectItem>
                <SelectItem value="120363000000000002@g.us">
                  Work
                </SelectItem>
                <SelectItem value="120363000000000003@g.us">
                  Customer support
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Members are messaged 1:1 — the group itself receives nothing.
            </p>
          </div>
        )}

        {state.source === 'tag' && (
          <div className="space-y-1">
            <Label>Contact tag</Label>
            <Input
              placeholder="e.g. newsletter"
              value={state.tag ?? ''}
              onChange={(e) => onChange({ ...state, tag: e.target.value })}
            />
          </div>
        )}

        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={exceeded ? 'danger' : 'secondary'}>
              {recipientCount.toLocaleString()} recipient
              {recipientCount === 1 ? '' : 's'}
            </Badge>
            <span className="text-xs text-[var(--st-text-secondary)]">
              cap {maxRecipients.toLocaleString()}
            </span>
          </div>
          {exceeded && (
            <p className="text-xs text-[var(--st-danger)]">
              Exceeds your plan cap. Upgrade or trim the list.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Step 2 — Compose ──────────────────────────────────────────────────────

interface Step2Props {
  state: ComposeState;
  onChange: (next: ComposeState) => void;
  sampleRow: CsvRow | undefined;
  availableVars: string[];
  templates: SabwaTemplate[];
}

function Step2Compose({
  state,
  onChange,
  sampleRow,
  availableVars,
  templates,
}: Step2Props) {
  const insertVar = (v: string) => {
    onChange({ ...state, body: `${state.body}{{${v}}}` });
  };
  const preview = substitute(state.body, sampleRow);
  const previewVariant = state.variantBody
    ? substitute(state.variantBody, sampleRow)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compose</CardTitle>
        <CardDescription>
          Write the message body. Use{' '}
          <code className="rounded bg-[var(--st-bg-secondary)] px-1 text-xs text-[var(--st-text)]">
            {'{{firstName}}'}
          </code>{' '}
          and other variables — they are substituted per recipient.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Start from a template</Label>
            <Select
              value={state.templateId ?? '__none__'}
              onValueChange={(v) => {
                if (v === '__none__') {
                  onChange({ ...state, templateId: null });
                  return;
                }
                const t = templates.find((x) => String(x._id) === v);
                onChange({
                  ...state,
                  templateId: v,
                  body: t?.body ?? state.body,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(write new)</SelectItem>
                {templates.map((t) => {
                  const id = String(t._id);
                  return (
                    <SelectItem key={id} value={id}>
                      {t.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Insert variable</Label>
            <div className="flex flex-wrap gap-1">
              {availableVars.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => insertVar(v)}
                >
                  <Plus className="h-3 w-3" />
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="body">Message body</Label>
          <Textarea
            id="body"
            value={state.body}
            onChange={(e) => onChange({ ...state, body: e.target.value })}
            rows={5}
            placeholder="Hi {{firstName}}, …"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Live preview</Label>
            <div className="min-h-[88px] whitespace-pre-wrap rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text)]">
              {preview || (
                <span className="text-[var(--st-text-secondary)]">
                  Preview shows here as you type.
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Media (SabFiles only)</Label>
            <div className="flex items-center gap-2">
              <SabFilePickerButton
                accept="all"
                onPick={(p) => onChange({ ...state, media: p })}
                variant="outline"
                className="h-8 gap-1 text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                {state.media ? 'Replace' : 'Attach media'}
              </SabFilePickerButton>
              {state.media && (
                <div className="flex items-center gap-1 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-1 text-xs text-[var(--st-text)]">
                  <span className="max-w-[160px] truncate">
                    {state.media.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange({ ...state, media: null })}
                    aria-label="Remove attachment"
                    className="rounded p-0.5 hover:bg-[var(--st-bg)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">A/B variant</Label>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Split-test a second body — recipients are randomly assigned.
              </p>
            </div>
            {state.variantBody === null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => onChange({ ...state, variantBody: '' })}
              >
                <Plus className="h-3.5 w-3.5" />
                Add variant
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onChange({ ...state, variantBody: null })}
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
          {state.variantBody !== null && (
            <>
              <Textarea
                value={state.variantBody}
                onChange={(e) =>
                  onChange({ ...state, variantBody: e.target.value })
                }
                rows={4}
                placeholder="Variant B body…"
              />
              {previewVariant && (
                <div className="whitespace-pre-wrap rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text)]">
                  {previewVariant}
                </div>
              )}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Step 3 — Review ───────────────────────────────────────────────────────

interface Step3Props {
  recipientCount: number;
  settings: SettingsState;
  onChange: (next: SettingsState) => void;
  warnings: string[];
}

function Step3Review({
  recipientCount,
  settings,
  onChange,
  warnings,
}: Step3Props) {
  const estimatedSec = recipientCount > 0
    ? (recipientCount / Math.max(settings.perMinute, 1)) * 60
    : 0;
  const firstContactRatio = settings.firstContactOnly ? 0 : 0.6;
  const risk = computeBanRisk({
    perMinute: settings.perMinute,
    recipientCount,
    firstContactRatio,
    jitterSec: settings.jitterSec,
  });
  const ratePreset: RatePreset =
    settings.perMinute <= 8
      ? 'safe'
      : settings.perMinute <= 15
        ? 'normal'
        : 'aggressive';

  const setPreset = (p: RatePreset) =>
    onChange({ ...settings, perMinute: RATE_PRESETS[p].perMinute });

  const riskColor: Record<typeof risk.label, string> = {
    low: 'text-[var(--st-status-ok)]',
    moderate: 'text-[var(--st-warn)]',
    high: 'text-[var(--st-warn)]',
    critical: 'text-[var(--st-danger)]',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review</CardTitle>
        <CardDescription>
          Final checks before run. Slow down if the ban-risk score is high.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
            <p className="text-xs text-[var(--st-text-secondary)]">Recipients</p>
            <p className="text-xl font-semibold tabular-nums text-[var(--st-text)]">
              {recipientCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
            <p className="text-xs text-[var(--st-text-secondary)]">Estimated duration</p>
            <p className="text-xl font-semibold tabular-nums text-[var(--st-text)]">
              {fmtDuration(estimatedSec)}
            </p>
          </div>
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
            <p className="text-xs text-[var(--st-text-secondary)]">Ban-risk score</p>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums',
                riskColor[risk.label],
              )}
            >
              {risk.score}/100 · {risk.label}
            </p>
          </div>
        </div>

        {warnings.length > 0 && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Anti-ban warnings</AlertTitle>
            <AlertDescription>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label className="text-sm">Send rate</Label>
          <div className="flex flex-wrap gap-2">
            {(['safe', 'normal', 'aggressive'] as RatePreset[]).map((p) => (
              <Button
                key={p}
                type="button"
                variant={ratePreset === p ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setPreset(p)}
              >
                {RATE_PRESETS[p].label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Slider
              min={1}
              max={30}
              step={1}
              value={[settings.perMinute]}
              onValueChange={(v) =>
                onChange({ ...settings, perMinute: v[0] ?? settings.perMinute })
              }
              className="flex-1"
            />
            <span className="w-16 text-right text-sm tabular-nums text-[var(--st-text)]">
              {settings.perMinute}/min
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Humanization jitter</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={2}
              max={10}
              step={1}
              value={[settings.jitterSec]}
              onValueChange={(v) =>
                onChange({ ...settings, jitterSec: v[0] ?? settings.jitterSec })
              }
              className="flex-1"
            />
            <span className="w-16 text-right text-sm tabular-nums text-[var(--st-text)]">
              ±{settings.jitterSec}s
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Send-window (hour of day)</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Select
                value={String(settings.windowStartHour)}
                onValueChange={(v) =>
                  onChange({ ...settings, windowStartHour: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {String(i).padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Select
                value={String(settings.windowEndHour)}
                onValueChange={(v) =>
                  onChange({ ...settings, windowEndHour: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {String(i).padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Timezone</Label>
              <Input
                value={settings.timezone}
                onChange={(e) =>
                  onChange({ ...settings, timezone: e.target.value })
                }
                placeholder="e.g. Asia/Kolkata"
              />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
          <Checkbox
            id="first-contact"
            checked={settings.firstContactOnly}
            onCheckedChange={(v) =>
              onChange({ ...settings, firstContactOnly: Boolean(v) })
            }
          />
          <div className="space-y-0.5">
            <Label htmlFor="first-contact" className="cursor-pointer text-sm">
              Skip first-contact recipients
            </Label>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Don&apos;t bulk-message contacts who have never messaged you.
              Strongly recommended.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-danger)]/40 bg-[var(--st-danger)]/5 p-3">
          <Checkbox
            id="accept-tos"
            checked={settings.acceptedToS}
            onCheckedChange={(v) =>
              onChange({ ...settings, acceptedToS: Boolean(v) })
            }
          />
          <div className="space-y-0.5">
            <Label htmlFor="accept-tos" className="cursor-pointer text-sm">
              I understand WhatsApp ToS risk and accept that my account may be
              banned.
            </Label>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Submit is disabled until this is checked. Bulk sending on a
              personal account is explicitly against WhatsApp&apos;s ToS.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Step 4 — Run ──────────────────────────────────────────────────────────

type CampaignStatus = 'running' | 'paused' | 'aborted' | 'completed';
type RecipientRunStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

interface RunRecipient {
  jid: string;
  status: RecipientRunStatus;
}

interface RunState {
  campaignId: string;
  status: CampaignStatus;
  perMinute: number;
  recipients: RunRecipient[];
  startedAt: number;
}

interface Step4Props {
  run: RunState;
  onControl: (op: 'pause' | 'resume' | 'abort') => void;
}

function campaignStatusBadgeVariant(
  status: CampaignStatus,
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'running') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'aborted') return 'danger';
  return 'secondary';
}

function recipientStatusBadgeVariant(
  status: RecipientRunStatus,
): 'success' | 'danger' | 'secondary' | 'outline' {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'secondary';
  return 'outline';
}

interface Step4PropsWithResolver extends Step4Props {
  resolve: (jid: string | undefined) => string;
}

function Step4Run({ run, onControl, resolve }: Step4PropsWithResolver) {
  const [filter, setFilter] = React.useState<'all' | RecipientRunStatus>('all');
  const total = run.recipients.length;
  const counts = React.useMemo(() => {
    const c: Record<RecipientRunStatus, number> = {
      pending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const r of run.recipients) c[r.status] += 1;
    return c;
  }, [run.recipients]);
  const done = counts.sent + counts.failed + counts.cancelled;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = counts.pending;
  const etaSec = (remaining / Math.max(run.perMinute, 1)) * 60;

  const filtered = run.recipients.filter(
    (r) => filter === 'all' || r.status === filter,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>Run</span>
          <Badge variant={campaignStatusBadgeVariant(run.status)}>
            {run.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Live progress for campaign{' '}
          <span className="font-mono">{run.campaignId}</span>.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
            <span>
              {done.toLocaleString()} / {total.toLocaleString()} processed
            </span>
            <span>ETA {fmtDuration(etaSec)}</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={run.status !== 'running'}
            onClick={() => onControl('pause')}
          >
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={run.status !== 'paused'}
            onClick={() => onControl('resume')}
          >
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1"
            disabled={run.status === 'aborted' || run.status === 'completed'}
            onClick={() => onControl('abort')}
          >
            <Square className="h-3.5 w-3.5" />
            Abort
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['pending', 'sent', 'failed', 'cancelled'] as const).map((k) => (
            <div
              key={k}
              className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-xs"
            >
              <p className="text-[var(--st-text-secondary)] capitalize">{k}</p>
              <p className="text-base font-semibold tabular-nums text-[var(--st-text)]">
                {counts[k]}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Filter</Label>
            <Select
              value={filter}
              onValueChange={(v) =>
                setFilter(v as 'all' | RecipientRunStatus)
              }
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  <Th>Recipient</Th>
                  <Th className="w-24 text-right">
                    Status
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.slice(0, 200).map((r) => {
                  const jidForLookup = r.jid.includes('@')
                    ? r.jid
                    : `${r.jid.replace(/\D/g, '')}@s.whatsapp.net`;
                  const resolved = resolve(jidForLookup);
                  const fallback = formatJid(r.jid);
                  return (
                    <Tr key={r.jid}>
                      <Td className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--st-text)]">
                            {resolved === jidForLookup ? fallback : resolved}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--st-text-secondary)]">
                            {fallback}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-right text-xs capitalize">
                        <Badge
                          variant={recipientStatusBadgeVariant(r.status)}
                          className="text-[10px]"
                        >
                          {r.status}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
                {filtered.length > 200 && (
                  <Tr>
                    <Td
                      colSpan={2}
                      className="text-center text-xs text-[var(--st-text-secondary)]"
                    >
                      …and {(filtered.length - 200).toLocaleString()} more
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Past campaigns ────────────────────────────────────────────────────────

interface PastCampaign {
  id: string;
  name: string;
  recipients: number;
  status: CampaignStatus;
  startedAt: Date;
}

function PastCampaignsTable({ items }: { items: PastCampaign[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Past campaigns</CardTitle>
        <CardDescription>
          Recent bulk sends from this session.
        </CardDescription>
      </CardHeader>
      <CardBody className="px-0">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
            No campaigns yet.
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th className="text-right">Recipients</Th>
                <Th>Status</Th>
                <Th>Started</Th>
              </Tr>
            </THead>
            <TBody>
              {items.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium text-[var(--st-text)]">
                    {c.name}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {c.recipients.toLocaleString()}
                  </Td>
                  <Td>
                    <Badge variant={campaignStatusBadgeVariant(c.status)}>
                      {c.status}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">
                    {c.startedAt.toLocaleString()}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BulkSenderPage() {
  const toaster = useToast();
  const { sessionUser } = useProject();
  const { current: currentSession } = useSabwaSession();
  const sessionId = currentSession?.id;
  const resolve = useResolveJid(sessionId ?? '');
  const planName = sessionUser?.plan?.name ?? 'free';
  const limits = React.useMemo(() => getSabwaLimits(planName), [planName]);
  const maxRecipients = quotaCap(limits.dailySend, 10_000);
  const bulkEnabled = limits.bulkSend.enabled;

  const templatesQ = useTemplates(sessionId);
  const templates = templatesQ.data ?? [];
  const campaignsQ = useBulkCampaignsRaw(sessionId);

  const [stepIdx, setStepIdx] = React.useState(0);
  const [furthest, setFurthest] = React.useState(0);

  const [audience, setAudience] = React.useState<AudienceState>({
    source: 'paste',
    pasted: '',
    csv: {
      headers: [],
      rows: [],
      phoneColumn: null,
      firstNameColumn: null,
      customColumns: {},
    },
    label: null,
    groupJid: null,
    tag: null,
  });
  const [compose, setCompose] = React.useState<ComposeState>({
    templateId: null,
    body: '',
    media: null,
    variantBody: null,
  });
  const [settings, setSettings] = React.useState<SettingsState>({
    perMinute: 8,
    jitterSec: 4,
    windowStartHour: 9,
    windowEndHour: 18,
    timezone:
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC',
    firstContactOnly: true,
    acceptedToS: false,
  });
  const [run, setRun] = React.useState<RunState | null>(null);
  const [pastCampaigns, setPastCampaigns] = React.useState<PastCampaign[]>([]);

  // Seed past-campaigns table from engine on each fetch — optimistic local
  // appends/updates from this page (start / pause / abort) replay on top.
  React.useEffect(() => {
    const list = campaignsQ.data;
    if (!list) return;
    const mapped: PastCampaign[] = list.map((c) => {
      const status: CampaignStatus =
        c.status === 'running' || c.status === 'paused' || c.status === 'aborted'
          ? c.status
          : 'completed';
      return {
        id: String(c._id),
        name: c.name,
        recipients: c.totalCount ?? 0,
        status,
        startedAt: new Date(c.startedAt ?? c.createdAt ?? Date.now()),
      };
    });
    setPastCampaigns(mapped);
  }, [campaignsQ.data]);

  // Anti-ban banner dismissal
  const [bannerOpen, setBannerOpen] = React.useState(true);
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(ANTIBAN_DISMISS_KEY);
      if (v === '1') setBannerOpen(false);
    } catch {
      // localStorage might be blocked — keep the banner open.
    }
  }, []);

  const dismissBanner = React.useCallback(() => {
    setBannerOpen(false);
    try {
      window.localStorage.setItem(ANTIBAN_DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const recipients = React.useMemo(
    () => getRecipientsFromAudience(audience),
    [audience],
  );
  const recipientCount = recipients.length;

  const availableVars = React.useMemo(() => {
    const base = ['firstName', 'name'];
    if (audience.source === 'csv') {
      for (const h of audience.csv.headers) {
        if (!base.includes(h)) base.push(h);
      }
    } else {
      base.push('custom1');
    }
    return base;
  }, [audience]);

  const sampleRow = React.useMemo<CsvRow | undefined>(() => {
    if (audience.source === 'csv' && audience.csv.rows.length > 0) {
      const row = { ...audience.csv.rows[0] } as CsvRow;
      if (audience.csv.firstNameColumn) {
        row.firstName = row[audience.csv.firstNameColumn] ?? '';
      }
      return row;
    }
    return { firstName: 'Asha', name: 'Asha Khan', custom1: 'VIP' };
  }, [audience]);

  const warnings = React.useMemo(() => {
    const out: string[] = [];
    if (settings.perMinute > 15)
      out.push(
        `Send rate ${settings.perMinute}/min is above the recommended 15/min ceiling.`,
      );
    if (settings.jitterSec < 4)
      out.push(`Jitter ${settings.jitterSec}s is below the 4-second floor.`);
    if (recipientCount > 2000 && !settings.firstContactOnly)
      out.push(
        'Large volume without first-contact filter — risk of mass-report spike.',
      );
    if (settings.windowEndHour - settings.windowStartHour < 4)
      out.push('Send-window is shorter than 4 hours — campaign may be slow.');
    if (compose.body.length > 0 && compose.body.length < 20)
      out.push('Very short body — increases the chance of being flagged as spam.');
    return out;
  }, [settings, recipientCount, compose.body.length]);

  const canSubmit =
    recipientCount > 0 &&
    recipientCount <= maxRecipients &&
    compose.body.trim().length > 0 &&
    settings.acceptedToS;

  const goNext = () => {
    setStepIdx((s) => {
      const next = Math.min(s + 1, STEPS.length - 1);
      setFurthest((f) => Math.max(f, next));
      return next;
    });
  };
  const goBack = () => setStepIdx((s) => Math.max(s - 1, 0));

  const startCampaign = () => {
    if (!canSubmit) return;
    const campaignId = `cmp_${Date.now().toString(36)}`;
    const runRecipients: RunRecipient[] = recipients.map((jid) => ({
      jid,
      status: 'pending',
    }));
    const next: RunState = {
      campaignId,
      status: 'running',
      perMinute: settings.perMinute,
      recipients: runRecipients,
      startedAt: Date.now(),
    };
    setRun(next);
    setStepIdx(3);
    setFurthest(3);
    setPastCampaigns((p) => [
      {
        id: campaignId,
        name: `Campaign ${new Date().toLocaleString()}`,
        recipients: recipients.length,
        status: 'running',
        startedAt: new Date(),
      },
      ...p,
    ]);
    toaster.toast({
      title: 'Campaign started',
      description: `${recipients.length} recipient${recipients.length === 1 ? '' : 's'} — rate ${settings.perMinute}/min`,
    });
  };

  // Simulated tick — replace with `getBulkCampaign(id)` poll + `useSabwaStream`
  // subscription once the engine bridge ships (SABWA_PLAN.md §13).
  React.useEffect(() => {
    if (!run || run.status !== 'running') return;
    const id = window.setInterval(() => {
      setRun((curr) => {
        if (!curr || curr.status !== 'running') return curr;
        const tickCount = Math.max(
          1,
          Math.round(curr.perMinute / 20), // ~3s tick
        );
        let mutated = false;
        const nextRecipients = curr.recipients.map((r) => {
          if (mutated || r.status !== 'pending') return r;
          mutated = true;
          return { ...r, status: 'sent' as const };
        });
        for (let k = 1; k < tickCount; k += 1) {
          const idx = nextRecipients.findIndex((r) => r.status === 'pending');
          if (idx === -1) break;
          nextRecipients[idx] = { ...nextRecipients[idx]!, status: 'sent' };
        }
        const stillPending = nextRecipients.some((r) => r.status === 'pending');
        return {
          ...curr,
          recipients: nextRecipients,
          status: stillPending ? 'running' : 'completed',
        };
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [run]);

  const handleControl = (op: 'pause' | 'resume' | 'abort') => {
    setRun((curr) => {
      if (!curr) return curr;
      if (op === 'pause') return { ...curr, status: 'paused' };
      if (op === 'resume') return { ...curr, status: 'running' };
      return {
        ...curr,
        status: 'aborted',
        recipients: curr.recipients.map((r) =>
          r.status === 'pending' ? { ...r, status: 'cancelled' } : r,
        ),
      };
    });
    if (run) {
      setPastCampaigns((p) =>
        p.map((c) =>
          c.id === run.campaignId
            ? {
                ...c,
                status:
                  op === 'abort'
                    ? 'aborted'
                    : op === 'pause'
                      ? 'paused'
                      : 'running',
              }
            : c,
        ),
      );
    }
  };

  if (!bulkEnabled) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Sparkles />}
          title="Upgrade required"
          description="Bulk sender is a Pro feature. Upgrade to unlock 2,000+ daily sends with anti-ban controls."
          action={
            <Link href="/dashboard/plans">
              <Button size="md">View plans</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 bg-[var(--st-bg)] p-3 md:p-6">
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
              <BreadcrumbPage>Bulk sender</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[20px] tracking-[-0.015em] text-[var(--st-text)] leading-[1.2]">
                Bulk Sender
              </h1>
              <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                Audience → Compose → Review → Run, with anti-ban guardrails.
              </p>
            </div>
          </div>
        </div>

        {bannerOpen && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between gap-2">
              <span>Anti-ban notice</span>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Dismiss"
                className="rounded p-0.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </AlertTitle>
            <AlertDescription className="text-xs">
              Bulk sending on a personal WhatsApp number can get the account
              banned. Defaults are conservative (8/min, ±4s jitter,
              9 AM–6 PM window) — only loosen them if you know your audience
              expects you. The campaign auto-pauses on presence drop or three
              consecutive send failures.
            </AlertDescription>
          </Alert>
        )}

        <Stepper
          current={stepIdx}
          onJump={(i) => setStepIdx(i)}
          furthestUnlocked={furthest}
        />

        {stepIdx === 0 && (
          <Step1Audience
            state={audience}
            onChange={setAudience}
            recipientCount={recipientCount}
            maxRecipients={maxRecipients}
          />
        )}
        {stepIdx === 1 && (
          <Step2Compose
            state={compose}
            onChange={setCompose}
            sampleRow={sampleRow}
            availableVars={availableVars}
            templates={templates}
          />
        )}
        {stepIdx === 2 && (
          <Step3Review
            recipientCount={recipientCount}
            settings={settings}
            onChange={setSettings}
            warnings={warnings}
          />
        )}
        {stepIdx === 3 && run && (
          <Step4Run run={run} onControl={handleControl} resolve={resolve} />
        )}
        {stepIdx === 3 && !run && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run</CardTitle>
              <CardDescription>
                No active campaign — head back to Review and submit.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIdx === 0}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {stepIdx < 2 && (
            <Button
              type="button"
              onClick={goNext}
              disabled={stepIdx === 0 && recipientCount === 0}
              className="gap-1"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {stepIdx === 2 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    onClick={startCampaign}
                    disabled={!canSubmit}
                    className="gap-1"
                  >
                    Start campaign
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canSubmit && (
                <TooltipContent>
                  {!settings.acceptedToS
                    ? 'Check the ToS confirmation to enable.'
                    : recipientCount === 0
                      ? 'Add at least one recipient.'
                      : compose.body.trim().length === 0
                        ? 'Message body is empty.'
                        : recipientCount > maxRecipients
                          ? 'Exceeds plan cap.'
                          : 'Resolve warnings above.'}
                </TooltipContent>
              )}
            </Tooltip>
          )}
          {stepIdx === 3 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRun(null);
                setStepIdx(0);
                setFurthest(0);
              }}
            >
              New campaign
            </Button>
          )}
        </div>

        <PastCampaignsTable items={pastCampaigns} />
      </div>
    </TooltipProvider>
  );
}
