'use client';

import {
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
  ZoruCardHeader,
  ZoruCardTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
  Textarea,
  cn,
} from '@/components/sabcrm/20ui/compat';
import {
  Beaker,
  Clock,
  Copy,
  Edit3,
  GripVertical,
  MessageSquareDashed,
  Plus,
  Send,
  Smartphone,
  Tag as TagIcon,
  Trash2,
  X,
  CheckCircle2,
  Workflow,
  MailWarning,
  } from 'lucide-react';

/**
 * SabWa — Auto-Reply (Page 17)
 *
 * Priority-ordered rule builder. Each rule binds one or more triggers
 * (keyword/contains/regex/time-window/contact-label/outside-business-hours/
 * first-message-from-new-contact) to one or more actions (send-template /
 * send-message / forward-to-flow / set-label / set-away-message).
 *
 * Rules are drag-to-reorder; first match wins. The page also embeds a
 * client-side **test sandbox** that runs the same matching logic over a
 * pasted message + sender, so users can verify their rules before going
 * live.
 *
 * Source of truth: SABWA_PLAN.md § 6 — Page 17.
 *
 * Rebuilt on ZoruUI primitives. Neutral zoru-* tokens only — no rainbow
 * accent colors. No tab UI per the ZoruUI design rules.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  listAutoReplies,
  upsertAutoReply,
  deleteAutoReply,
  setAutoReplyEnabled,
  reorderAutoReplies,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import type { SabwaAutoReply } from '@/lib/sabwa/types';

// ─── Client-side rule model ────────────────────────────────────────────────

type TriggerKind =
  | 'keyword'
  | 'contains_all'
  | 'contains_any'
  | 'regex'
  | 'time_window'
  | 'contact_label'
  | 'first_message_from_new_contact'
  | 'outside_business_hours';

type ActionKind =
  | 'send_template'
  | 'send_message'
  | 'forward_to_flow'
  | 'set_label'
  | 'set_away_message';

interface UiTrigger {
  kind: TriggerKind;
  value?: string;
  caseSensitive?: boolean;
  start?: string; // HH:mm for time_window
  end?: string;
}

interface UiAction {
  kind: ActionKind;
  templateId?: string;
  flowId?: string;
  labelId?: string;
  message?: string;
}

interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  triggers: UiTrigger[];
  actions: UiAction[];
  lastFiredAt?: Date | string;
}

const TRIGGER_OPTIONS: { value: TriggerKind; label: string }[] = [
  { value: 'keyword', label: 'Keyword match' },
  { value: 'contains_any', label: 'Contains any of' },
  { value: 'contains_all', label: 'Contains all of' },
  { value: 'regex', label: 'Regex match' },
  { value: 'time_window', label: 'Time-of-day window' },
  { value: 'contact_label', label: 'Contact has label' },
  {
    value: 'first_message_from_new_contact',
    label: 'First message from new contact',
  },
  { value: 'outside_business_hours', label: 'Outside business hours' },
];

const ACTION_OPTIONS: { value: ActionKind; label: string }[] = [
  { value: 'send_template', label: 'Send template' },
  { value: 'send_message', label: 'Send free-form message' },
  { value: 'forward_to_flow', label: 'Forward to SabFlow' },
  { value: 'set_label', label: 'Set chat label' },
  { value: 'set_away_message', label: 'Set away message' },
];

function toRuleRow(r: SabwaAutoReply): RuleRow {
  return {
    id: String(r._id),
    name: r.name,
    enabled: r.enabled,
    triggers: (r.triggers ?? []).map((t) => ({
      kind: t.kind as TriggerKind,
      value: t.value,
      start: t.start,
      end: t.end,
    })),
    actions: (r.actions ?? []).map((a) => ({
      kind: a.kind as ActionKind,
      templateId: a.templateId ? String(a.templateId) : undefined,
      flowId: a.flowId ? String(a.flowId) : undefined,
      labelId: a.labelId ? String(a.labelId) : undefined,
      message: a.message,
    })),
  };
}

function summariseTriggers(triggers: UiTrigger[]): string {
  if (triggers.length === 0) return 'No triggers';
  return triggers
    .map((t) => {
      switch (t.kind) {
        case 'keyword':
          return `keyword="${t.value ?? ''}"`;
        case 'contains_all':
          return `all of [${t.value ?? ''}]`;
        case 'contains_any':
          return `any of [${t.value ?? ''}]`;
        case 'regex':
          return `regex /${t.value ?? ''}/`;
        case 'time_window':
          return `between ${t.start ?? '?'}–${t.end ?? '?'}`;
        case 'contact_label':
          return `label:${t.value ?? ''}`;
        case 'first_message_from_new_contact':
          return 'first message';
        case 'outside_business_hours':
          return 'after hours';
        default:
          return t.kind;
      }
    })
    .join(' • ');
}

function summariseActions(actions: UiAction[]): string {
  if (actions.length === 0) return 'No actions';
  return actions
    .map((a) => {
      switch (a.kind) {
        case 'send_template':
          return `→ template:${a.templateId ?? '?'}`;
        case 'send_message':
          return `→ "${(a.message ?? '').slice(0, 24)}…"`;
        case 'forward_to_flow':
          return `→ flow:${a.flowId ?? '?'}`;
        case 'set_label':
          return `→ label:${a.labelId ?? '?'}`;
        case 'set_away_message':
          return `→ away "${(a.message ?? '').slice(0, 16)}…"`;
        default:
          return a.kind;
      }
    })
    .join(' • ');
}

// ─── Trigger evaluator (test sandbox) ──────────────────────────────────────

interface SandboxContext {
  message: string;
  sender: string;
  senderTags: string[];
  isNewContact: boolean;
  now: Date;
  businessHoursStart: string; // HH:mm
  businessHoursEnd: string;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function evaluateTrigger(t: UiTrigger, ctx: SandboxContext): boolean {
  const msg = ctx.message;
  const lower = msg.toLowerCase();
  switch (t.kind) {
    case 'keyword': {
      const v = (t.value ?? '').trim();
      if (!v) return false;
      return t.caseSensitive
        ? msg.split(/\s+/).includes(v)
        : lower.split(/\s+/).includes(v.toLowerCase());
    }
    case 'contains_all': {
      const parts = (t.value ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (parts.length === 0) return false;
      return parts.every((p) => lower.includes(p));
    }
    case 'contains_any': {
      const parts = (t.value ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (parts.length === 0) return false;
      return parts.some((p) => lower.includes(p));
    }
    case 'regex': {
      try {
        const re = new RegExp(t.value ?? '', t.caseSensitive ? '' : 'i');
        return re.test(msg);
      } catch {
        return false;
      }
    }
    case 'time_window': {
      const now = ctx.now.getHours() * 60 + ctx.now.getMinutes();
      const s = timeToMinutes(t.start ?? '00:00');
      const e = timeToMinutes(t.end ?? '23:59');
      if (s <= e) return now >= s && now <= e;
      // overnight window
      return now >= s || now <= e;
    }
    case 'contact_label': {
      const target = (t.value ?? '').toLowerCase();
      return ctx.senderTags.map((x) => x.toLowerCase()).includes(target);
    }
    case 'first_message_from_new_contact':
      return ctx.isNewContact;
    case 'outside_business_hours': {
      const now = ctx.now.getHours() * 60 + ctx.now.getMinutes();
      const s = timeToMinutes(ctx.businessHoursStart);
      const e = timeToMinutes(ctx.businessHoursEnd);
      return !(now >= s && now <= e);
    }
    default:
      return false;
  }
}

function evaluateRule(rule: RuleRow, ctx: SandboxContext): boolean {
  if (!rule.enabled) return false;
  if (rule.triggers.length === 0) return false;
  // AND across triggers — fires only when every trigger matches.
  return rule.triggers.every((t) => evaluateTrigger(t, ctx));
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Page() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? null;
  const [rules, setRules] = React.useState<RuleRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RuleRow | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const refresh = React.useCallback(async () => {
    if (!sessionId) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listAutoReplies(sessionId);
    setRules(res.ok ? res.autoReplies.map(toRuleRow) : []);
    setLoading(false);
  }, [sessionId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (r: RuleRow) => {
    setEditing(r);
    setEditorOpen(true);
  };

  const onDelete = async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await deleteAutoReply(id);
  };

  const onToggle = async (r: RuleRow, enabled: boolean) => {
    setRules((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, enabled } : x)),
    );
    await setAutoReplyEnabled(r.id, enabled);
  };

  const onDuplicate = async (r: RuleRow) => {
    if (!sessionId) return;
    const next: RuleRow = { ...r, id: '', name: `${r.name} (copy)` };
    await upsertAutoReply({
      sessionId,
      name: next.name,
      enabled: r.enabled,
      triggers: r.triggers.map((t) => ({
        kind: t.kind,
        value: t.value,
        start: t.start,
        end: t.end,
      })),
      actions: r.actions.map((a) => ({
        kind: a.kind,
        templateId: a.templateId,
        flowId: a.flowId,
        labelId: a.labelId,
        message: a.message,
      })),
    });
    await refresh();
  };

  // Drag-to-reorder.
  const onDragStart = (i: number) => setDragIndex(i);
  const onDragOver = (e: React.DragEvent<HTMLLIElement>) => e.preventDefault();
  const onDrop = async (i: number) => {
    if (dragIndex === null || dragIndex === i) {
      setDragIndex(null);
      return;
    }
    const reordered = [...rules];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(i, 0, moved);
    setRules(reordered);
    setDragIndex(null);
    if (!sessionId) return;
    await reorderAutoReplies(
      sessionId,
      reordered.map((r) => r.id),
    );
  };

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
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
              <ZoruBreadcrumbPage>Auto-reply</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>
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
            <ZoruBreadcrumbPage>Auto-reply</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
            <MessageSquareDashed className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
              Auto-reply
            </h1>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">
              Match inbound messages on triggers, then run actions. Drag rules
              to set priority — first match wins.
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New rule
        </Button>
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-[14px]">Rules</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          {loading && rules.length === 0 && (
            <p className="px-6 py-10 text-center text-[13px] text-zoru-ink-muted">
              Loading rules…
            </p>
          )}
          {!loading && rules.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={<MessageSquareDashed />}
                title="No auto-reply rules yet"
                description="Match inbound messages on keywords, regex, or sender — then reply, label, or forward automatically. First matching rule wins, so order matters."
                action={
                  <Button onClick={openNew}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create first rule
                  </Button>
                }
              />
            </div>
          )}
          <ul className="divide-y divide-zoru-line">
            {rules.map((r, i) => (
              <li
                key={r.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={() => void onDrop(i)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  dragIndex === i && 'opacity-50',
                )}
              >
                <button
                  type="button"
                  aria-label="Drag to reorder"
                  className="cursor-grab text-zoru-ink-muted"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <Badge variant="outline" className="font-mono text-[10px]">
                  #{i + 1}
                </Badge>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => void onToggle(r, v)}
                  aria-label={`Toggle ${r.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zoru-ink">{r.name}</p>
                  <p className="truncate text-[11.5px] text-zoru-ink-muted">
                    <span className="font-medium">When:</span>{' '}
                    {summariseTriggers(r.triggers)}
                  </p>
                  <p className="truncate text-[11.5px] text-zoru-ink-muted">
                    <span className="font-medium">Then:</span>{' '}
                    {summariseActions(r.actions)}
                  </p>
                </div>
                <span className="hidden text-[11.5px] text-zoru-ink-muted sm:inline">
                  {r.lastFiredAt ? 'Fired' : 'Never fired'}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Duplicate ${r.name}`}
                  onClick={() => void onDuplicate(r)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${r.name}`}
                  onClick={() => openEdit(r)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-zoru-danger"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => void onDelete(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </ZoruCardContent>
      </Card>

      {/* Test sandbox */}
      <TestSandbox rules={rules} />

      <RuleEditorDialog
        sessionId={sessionId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        onSaved={async () => {
          setEditorOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

// ─── Test sandbox ──────────────────────────────────────────────────────────

function TestSandbox({ rules }: { rules: RuleRow[] }) {
  const [message, setMessage] = React.useState('Hey, can you help me track order #42?');
  const [sender, setSender] = React.useState('+91 9876543210');
  const [senderTags, setSenderTags] = React.useState('VIP, support');
  const [isNewContact, setIsNewContact] = React.useState(false);
  const [bizStart, setBizStart] = React.useState('09:00');
  const [bizEnd, setBizEnd] = React.useState('18:00');
  const [results, setResults] = React.useState<{
    matches: RuleRow[];
    firstMatch?: RuleRow;
  } | null>(null);

  const runTest = () => {
    const ctx: SandboxContext = {
      message,
      sender,
      senderTags: senderTags.split(',').map((s) => s.trim()).filter(Boolean),
      isNewContact,
      now: new Date(),
      businessHoursStart: bizStart,
      businessHoursEnd: bizEnd,
    };
    const matches = rules.filter((r) => evaluateRule(r, ctx));
    setResults({ matches, firstMatch: matches[0] });
  };

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="flex items-center gap-2 text-[14px]">
          <Beaker className="h-4 w-4" /> Test sandbox
        </ZoruCardTitle>
        <p className="text-[11.5px] text-zoru-ink-muted">
          Pure client-side simulation — no message is sent. Verify which rules
          would fire for a given inbound.
        </p>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sb-sender">From (sender)</Label>
            <Input
              id="sb-sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="+91 9876543210"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-tags">Sender labels (comma-separated)</Label>
            <Input
              id="sb-tags"
              value={senderTags}
              onChange={(e) => setSenderTags(e.target.value)}
              placeholder="VIP, support"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line p-2">
            <Switch
              checked={isNewContact}
              onCheckedChange={setIsNewContact}
              id="sb-new"
              aria-label="New contact toggle"
            />
            <Label htmlFor="sb-new" className="text-[11.5px]">
              First message from new contact
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11.5px]">Business hours start</Label>
            <Input
              type="time"
              value={bizStart}
              onChange={(e) => setBizStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11.5px]">Business hours end</Label>
            <Input
              type="time"
              value={bizEnd}
              onChange={(e) => setBizEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sb-msg">Inbound message</Label>
          <Textarea
            id="sb-msg"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <Button onClick={runTest}>
          <Beaker className="mr-2 h-4 w-4" /> Run test
        </Button>

        {results && (
          <div className="space-y-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-3">
            {results.matches.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-zoru-ink">
                <MailWarning className="h-4 w-4 text-zoru-ink-muted" />
                No rules matched. Nothing would fire.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[13px] font-medium text-zoru-ink">
                  <CheckCircle2 className="h-4 w-4 text-zoru-success" />
                  First match wins:{' '}
                  <Badge variant="success" className="text-[10px]">
                    {results.firstMatch?.name}
                  </Badge>
                </p>
                <Separator />
                <p className="text-[11.5px] font-medium text-zoru-ink-muted">
                  Actions that would run:
                </p>
                <ul className="space-y-1 text-[11.5px]">
                  {results.firstMatch?.actions.map((a, idx) => (
                    <li
                      key={idx}
                      className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-2 py-1 text-zoru-ink"
                    >
                      {summariseActions([a])}
                    </li>
                  ))}
                </ul>
                {results.matches.length > 1 && (
                  <>
                    <Separator />
                    <p className="text-[11.5px] text-zoru-ink-muted">
                      Other rules that also matched (but won&apos;t run):
                    </p>
                    <ul className="space-y-1 text-[11.5px]">
                      {results.matches.slice(1).map((m) => (
                        <li key={m.id}>
                          <Badge variant="outline" className="text-[10px]">
                            {m.name}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}

// ─── Rule editor ───────────────────────────────────────────────────────────

interface RuleEditorDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RuleRow | null;
  onSaved: () => void;
}

function RuleEditorDialog({
  sessionId,
  open,
  onOpenChange,
  initial,
  onSaved,
}: RuleEditorDialogProps) {
  const [name, setName] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [triggers, setTriggers] = React.useState<UiTrigger[]>([]);
  const [actions, setActions] = React.useState<UiAction[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setEnabled(initial?.enabled ?? true);
    setTriggers(initial?.triggers ?? [{ kind: 'keyword', value: '' }]);
    setActions(initial?.actions ?? [{ kind: 'send_message', message: '' }]);
  }, [open, initial]);

  const addTrigger = () =>
    setTriggers((prev) => [...prev, { kind: 'keyword', value: '' }]);
  const removeTrigger = (i: number) =>
    setTriggers((prev) => prev.filter((_, idx) => idx !== i));
  const updateTrigger = (i: number, patch: Partial<UiTrigger>) =>
    setTriggers((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    );

  const addAction = () =>
    setActions((prev) => [...prev, { kind: 'send_message', message: '' }]);
  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<UiAction>) =>
    setActions((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );

  const valid = !!name.trim() && triggers.length > 0 && actions.length > 0;

  const onSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    await upsertAutoReply({
      id: initial?.id,
      sessionId,
      name: name.trim(),
      enabled,
      triggers: triggers.map((t) => ({
        kind: t.kind,
        value: t.value,
        start: t.start,
        end: t.end,
      })),
      actions: actions.map((a) => ({
        kind: a.kind,
        templateId: a.templateId,
        flowId: a.flowId,
        labelId: a.labelId,
        message: a.message,
      })),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-3xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            {initial ? 'Edit rule' : 'New auto-reply rule'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Compose triggers (left) and actions (right). All triggers must match
            for the rule to fire.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="After-hours auto-reply"
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                id="rule-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="rule-enabled" className="text-[13px]">
                Enabled
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Triggers column */}
            <section className="space-y-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  Triggers (AND)
                </h3>
                <Button size="sm" variant="ghost" onClick={addTrigger}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                {triggers.map((t, i) => (
                  <TriggerEditor
                    key={i}
                    trigger={t}
                    onChange={(patch) => updateTrigger(i, patch)}
                    onRemove={() => removeTrigger(i)}
                  />
                ))}
                {triggers.length === 0 && (
                  <p className="text-[11.5px] text-zoru-ink-muted">
                    Add at least one trigger.
                  </p>
                )}
              </div>
            </section>

            {/* Actions column */}
            <section className="space-y-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-zoru-ink">
                  Actions
                </h3>
                <Button size="sm" variant="ghost" onClick={addAction}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                {actions.map((a, i) => (
                  <ActionEditor
                    key={i}
                    action={a}
                    onChange={(patch) => updateAction(i, patch)}
                    onRemove={() => removeAction(i)}
                  />
                ))}
                {actions.length === 0 && (
                  <p className="text-[11.5px] text-zoru-ink-muted">
                    Add at least one action.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>

        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={!valid || saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create rule'}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ─── Trigger / Action editors ──────────────────────────────────────────────

interface TriggerEditorProps {
  trigger: UiTrigger;
  onChange: (patch: Partial<UiTrigger>) => void;
  onRemove: () => void;
}

function TriggerEditor({ trigger, onChange, onRemove }: TriggerEditorProps) {
  const needsTimeRange = trigger.kind === 'time_window';
  const needsValue =
    trigger.kind === 'keyword' ||
    trigger.kind === 'contains_all' ||
    trigger.kind === 'contains_any' ||
    trigger.kind === 'regex' ||
    trigger.kind === 'contact_label';
  return (
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2">
      <div className="flex items-center gap-2">
        <Select
          value={trigger.kind}
          onValueChange={(v) => onChange({ kind: v as TriggerKind })}
        >
          <ZoruSelectTrigger className="h-8 text-[13px]">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {TRIGGER_OPTIONS.map((o) => (
              <ZoruSelectItem key={o.value} value={o.value}>
                {o.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Remove trigger"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {needsValue && (
        <Input
          value={trigger.value ?? ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={
            trigger.kind === 'regex'
              ? '^order\\s+\\d+$'
              : trigger.kind === 'contact_label'
                ? 'VIP'
                : 'hi, hello, hey'
          }
          className="h-8 text-[13px]"
        />
      )}
      {trigger.kind === 'regex' && (
        <label className="flex items-center gap-2 text-[11.5px] text-zoru-ink-muted">
          <Switch
            checked={trigger.caseSensitive ?? false}
            onCheckedChange={(v) => onChange({ caseSensitive: v })}
          />
          Case-sensitive
        </label>
      )}
      {needsTimeRange && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="time"
            value={trigger.start ?? '09:00'}
            onChange={(e) => onChange({ start: e.target.value })}
            className="h-8 text-[13px]"
          />
          <Input
            type="time"
            value={trigger.end ?? '18:00'}
            onChange={(e) => onChange({ end: e.target.value })}
            className="h-8 text-[13px]"
          />
        </div>
      )}
      {trigger.kind === 'outside_business_hours' && (
        <p className="flex items-center gap-1 text-[11px] text-zoru-ink-muted">
          <Clock className="h-3 w-3" /> Uses sandbox business-hours window.
        </p>
      )}
    </div>
  );
}

interface ActionEditorProps {
  action: UiAction;
  onChange: (patch: Partial<UiAction>) => void;
  onRemove: () => void;
}

function ActionEditor({ action, onChange, onRemove }: ActionEditorProps) {
  return (
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2">
      <div className="flex items-center gap-2">
        <Select
          value={action.kind}
          onValueChange={(v) => onChange({ kind: v as ActionKind })}
        >
          <ZoruSelectTrigger className="h-8 text-[13px]">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {ACTION_OPTIONS.map((o) => (
              <ZoruSelectItem key={o.value} value={o.value}>
                {o.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Remove action"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {action.kind === 'send_template' && (
        <Input
          value={action.templateId ?? ''}
          onChange={(e) => onChange({ templateId: e.target.value })}
          placeholder="Template ID — TODO: template picker"
          className="h-8 text-[13px]"
        />
      )}
      {(action.kind === 'send_message' ||
        action.kind === 'set_away_message') && (
        <Textarea
          rows={2}
          value={action.message ?? ''}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder={
            action.kind === 'set_away_message'
              ? 'We’re away — we’ll reply tomorrow at 9 AM.'
              : 'Free-form reply…'
          }
          className="text-[13px]"
        />
      )}
      {action.kind === 'forward_to_flow' && (
        <div className="space-y-1.5">
          <Input
            value={action.flowId ?? ''}
            onChange={(e) => onChange({ flowId: e.target.value })}
            placeholder="SabFlow ID"
            className="h-8 text-[13px]"
          />
          <p className="flex items-center gap-1 text-[11px] text-zoru-ink-muted">
            <Workflow className="h-3 w-3" /> Hand off to a SabFlow chatbot.
          </p>
        </div>
      )}
      {action.kind === 'set_label' && (
        <div className="space-y-1.5">
          <Input
            value={action.labelId ?? ''}
            onChange={(e) => onChange({ labelId: e.target.value })}
            placeholder="Label ID"
            className="h-8 text-[13px]"
          />
          <p className="flex items-center gap-1 text-[11px] text-zoru-ink-muted">
            <TagIcon className="h-3 w-3" /> Tag the chat after the rule fires.
          </p>
        </div>
      )}
      {action.kind === 'send_message' && (
        <p className="flex items-center gap-1 text-[11px] text-zoru-ink-muted">
          <Send className="h-3 w-3" /> Sent immediately on the active session.
        </p>
      )}
    </div>
  );
}
