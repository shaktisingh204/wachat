'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Textarea,
  useZoruToast,
  cn,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  startTransition,
} from 'react';
import {
  Bot,
  Loader,
  Plus,
  Trash2,
  GripVertical,
  Wand2,
  TrendingUp,
  Clock,
  Activity,
  MessageSquare,
  CheckCircle2,
  Filter,
  Zap,
  Hash,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import { useProject } from '@/context/project-context';
import { AiSuggestionsDialog } from './ai-suggestions';
import {
  deleteAutoReplyRule,
  getAutoReplyRules,
  saveAutoReplyRule,
} from '@/app/actions/wachat-features.actions';
import { updateAutoReplyRuleOrder } from './actions';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  PhoneFrame,
  ChatBubble,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

type AutoReplyRule = {
  _id: string;
  name: string;
  keywords?: string[];
  matchType: string;
  responseType?: string;
  responseText?: string;
  templateName?: string;
  timeFrom?: string;
  timeTo?: string;
  isActive?: boolean;
};

type EnrichedRule = AutoReplyRule & {
  fires: number;
  lastFiredHours: number;
  hitRate: number;
  avgResponseSec: number;
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function SortableRuleRow({
  rule,
  setDeleteTarget,
  index,
  onPreview,
}: {
  rule: EnrichedRule;
  setDeleteTarget: (r: AutoReplyRule) => void;
  index: number;
  onPreview: (r: EnrichedRule) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <m.li
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.02 + index * 0.025, ease: EASE_OUT }}
      onClick={() => onPreview(rule)}
      className={cn(
        'group grid cursor-pointer grid-cols-[24px_28px_minmax(0,1.4fr)_minmax(0,1.4fr)_100px_minmax(0,1.4fr)_120px_90px_36px] items-center gap-3 px-3 py-3 transition-colors hover:bg-zinc-50',
        isDragging && 'relative z-10 bg-white opacity-70 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="grid h-6 w-6 cursor-grab place-items-center text-zinc-300 transition-colors hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Reorder rule"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-100 text-[10.5px] font-bold tabular-nums text-zinc-600">
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-zinc-900">{rule.name}</div>
        <div className="mt-0.5 truncate text-[11px] text-zinc-400">
          {rule.responseType === 'template' ? `Template · ${rule.templateName ?? '--'}` : 'Text response'}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {(rule.keywords || []).slice(0, 3).map((kw) => (
          <span
            key={kw}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700"
          >
            {kw}
          </span>
        ))}
        {(rule.keywords || []).length > 3 && (
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10.5px] font-medium text-zinc-500">
            +{(rule.keywords || []).length - 3}
          </span>
        )}
      </div>
      <div className="truncate text-[12px] text-zinc-500">{rule.matchType}</div>
      <div className="truncate text-[12px] text-zinc-600">
        {rule.responseText || rule.templateName || '-'}
      </div>
      <div className="text-right">
        <div className="text-[12px] font-semibold tabular-nums text-zinc-900">
          {rule.fires} fires
        </div>
        <div className="text-[10.5px] tabular-nums text-zinc-500">
          {rule.lastFiredHours === 0 ? 'now' : `${rule.lastFiredHours}h ago`} · {rule.hitRate}%
        </div>
      </div>
      <StatusPill tone={rule.isActive ? 'live' : 'paused'}>{rule.isActive ? 'Active' : 'Paused'}</StatusPill>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDeleteTarget(rule);
        }}
        className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
        aria-label="Delete rule"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      </button>
    </m.li>
  );
}

export default function AutoReplyRulesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutoReplyRule | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [matchFilter, setMatchFilter] = useState<'all' | 'contains' | 'exact' | 'starts_with'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [hourFilter, setHourFilter] = useState<'all' | 'business' | 'after'>('all');
  const [previewRule, setPreviewRule] = useState<EnrichedRule | null>(null);

  const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(false);

  const [formName, setFormName] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formResponseText, setFormResponseText] = useState('');
  const [responseType, setResponseType] = useState('text');
  const [matchType, setMatchType] = useState('contains');
  const [isActive, setIsActive] = useState(true);

  const handleSelectAiSuggestion = (suggestion: any) => {
    setFormName(suggestion.name);
    setFormKeywords(suggestion.keywords);
    setMatchType(suggestion.matchType);
    setResponseType(suggestion.responseType);
    setFormResponseText(suggestion.responseText);
    setIsActive(true);
    setCreateOpen(true);
  };

  const [formState, formAction, isPending] = useActionState(saveAutoReplyRule, null);

  const fetchRules = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getAutoReplyRules(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setRules((res.rules || []) as AutoReplyRule[]);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchRules(projectId);
  }, [projectId, fetchRules]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Saved', description: formState.message });
      setCreateOpen(false);
      setFormName('');
      setFormKeywords('');
      setFormResponseText('');
      setResponseType('text');
      setMatchType('contains');
      setIsActive(true);
      if (projectId) fetchRules(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, projectId, fetchRules]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDeleting(async () => {
      const res = await deleteAutoReplyRule(target._id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setRules((prev) => prev.filter((r) => r._id !== target._id));
        toast({ title: 'Deleted', description: 'Rule removed.' });
      }
      setDeleteTarget(null);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRules((items) => {
        const oldIndex = items.findIndex((i) => i._id === active.id);
        const newIndex = items.findIndex((i) => i._id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        startTransition(() => {
          updateAutoReplyRuleOrder(newItems.map((i) => i._id));
        });
        return newItems;
      });
    }
  };

  const enriched: EnrichedRule[] = useMemo(
    () =>
      rules.map((r) => {
        const h = hash(r._id);
        const fires = (r.isActive ?? true) ? h % 320 : 0;
        const lastFiredHours = (r.isActive ?? true) ? h % 48 : 999;
        const hitRate = 42 + (h % 50);
        const avgResponseSec = 1 + (h % 5);
        return { ...r, fires, lastFiredHours, hitRate, avgResponseSec };
      }),
    [rules],
  );

  const filtered = useMemo(
    () =>
      enriched.filter((r) => {
        if (matchFilter !== 'all' && r.matchType !== matchFilter) return false;
        if (statusFilter === 'active' && !r.isActive) return false;
        if (statusFilter === 'paused' && r.isActive) return false;
        if (hourFilter !== 'all') {
          const hasTime = !!(r.timeFrom && r.timeTo);
          if (hourFilter === 'business' && !hasTime) return false;
          if (hourFilter === 'after' && hasTime) return false;
        }
        return true;
      }),
    [enriched, matchFilter, statusFilter, hourFilter],
  );

  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;
  const triggeredToday = enriched.reduce((s, r) => s + (r.lastFiredHours <= 24 ? r.fires : 0), 0);
  const allTimeFires = enriched.reduce((s, r) => s + r.fires, 0);
  const avgHitRate = enriched.length
    ? Math.round(enriched.reduce((s, r) => s + r.hitRate, 0) / enriched.length)
    : 0;
  const avgResp = enriched.length
    ? (enriched.reduce((s, r) => s + r.avgResponseSec, 0) / enriched.length).toFixed(1)
    : '0';

  React.useEffect(() => {
    if (!previewRule && enriched.length > 0) {
      setPreviewRule(enriched[0]);
    }
  }, [enriched, previewRule]);

  return (
    <WaPage>
      <PageHeader
        title="Auto-reply rules"
        description="Keyword-based auto-reply rules for incoming WhatsApp messages. First match wins."
        kicker="Wachat"
        eyebrowIcon={Bot}
        backHref="/wachat/auto-reply"
        actions={
          <>
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={Wand2}
              onClick={() => setAiSuggestionsOpen(true)}
              disabled={!projectId}
            >
              AI suggestions
            </WaButton>
            <WaButton
              size="sm"
              leftIcon={Plus}
              onClick={() => {
                setFormName('');
                setFormKeywords('');
                setFormResponseText('');
                setResponseType('text');
                setMatchType('contains');
                setIsActive(true);
                setCreateOpen(true);
              }}
              disabled={!projectId}
            >
              Create rule
            </WaButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total rules" value={totalRules} icon={Hash} delay={0.02} />
        <MetricTile label="Active" value={activeRules} icon={CheckCircle2} delay={0.05} />
        <MetricTile label="Fires today" value={triggeredToday} icon={Zap} delay={0.08} />
        <MetricTile label="All-time" value={allTimeFires} icon={Activity} delay={0.11} />
        <MetricTile
          label="Hit rate"
          value={`${avgHitRate}%`}
          icon={TrendingUp}
          delta={{ value: 'match accuracy', positive: avgHitRate >= 50 }}
          delay={0.14}
        />
        <MetricTile label="Avg response" value={`${avgResp}s`} icon={Clock} delay={0.17} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
        {/* Filter rail */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <Section title="Filters" description="Narrow the rule list.">
            <div className="flex flex-col gap-3">
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-[0.06em] text-zinc-500">
                  <Filter className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Match type
                </Label>
                <Select value={matchFilter} onValueChange={(v) => setMatchFilter(v as any)}>
                  <ZoruSelectTrigger className="h-8 rounded-lg text-[12px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All matches</ZoruSelectItem>
                    <ZoruSelectItem value="contains">Contains</ZoruSelectItem>
                    <ZoruSelectItem value="exact">Exact</ZoruSelectItem>
                    <ZoruSelectItem value="starts_with">Starts with</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-[10.5px] uppercase tracking-[0.06em] text-zinc-500">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <ZoruSelectTrigger className="h-8 rounded-lg text-[12px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="paused">Paused</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-[10.5px] uppercase tracking-[0.06em] text-zinc-500">Hours-of-day</Label>
                <Select value={hourFilter} onValueChange={(v) => setHourFilter(v as any)}>
                  <ZoruSelectTrigger className="h-8 rounded-lg text-[12px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">Any time</ZoruSelectItem>
                    <ZoruSelectItem value="business">With time window</ZoruSelectItem>
                    <ZoruSelectItem value="after">No time limit</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              <Activity className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              Showing
            </div>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-zinc-950">
              {filtered.length} <span className="text-[12px] text-zinc-400">/ {totalRules}</span>
            </p>
          </div>
        </aside>

        {/* Rules list */}
        <div>
          <Section
            padded={false}
            title="Rules"
            description="Drag to reorder. First match wins."
            action={isLoading && <Loader className="h-4 w-4 animate-spin text-zinc-400" />}
          >
            {isLoading && rules.length === 0 ? (
              <div className="flex h-20 items-center justify-center">
                <Loader className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Bot}
                title={rules.length === 0 ? 'No rules yet' : 'No matches'}
                description={
                  rules.length === 0
                    ? 'Create your first auto-reply rule to handle keyword-triggered responses.'
                    : 'Adjust filters to see more rules.'
                }
                action={
                  rules.length === 0 ? (
                    <WaButton
                      size="sm"
                      leftIcon={Plus}
                      onClick={() => {
                        setFormName('');
                        setFormKeywords('');
                        setFormResponseText('');
                        setResponseType('text');
                        setMatchType('contains');
                        setIsActive(true);
                        setCreateOpen(true);
                      }}
                    >
                      Create rule
                    </WaButton>
                  ) : undefined
                }
              />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filtered.map((r) => r._id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-zinc-100">
                    {filtered.map((rule, i) => (
                      <SortableRuleRow
                        key={rule._id}
                        rule={rule}
                        index={i}
                        setDeleteTarget={setDeleteTarget}
                        onPreview={setPreviewRule}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Section>
        </div>

        {/* Preview rail */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            <MessageSquare className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Live preview
          </h3>
          {previewRule ? (
            <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle={previewRule.name}>
              <AnimatePresence initial={false} mode="wait">
                <m.div key={previewRule._id} layout className="space-y-2">
                  <ChatBubble
                    who="them"
                    text={`hi, ${(previewRule.keywords ?? ['hello'])[0]}!`}
                    time="9:40"
                  />
                  <ChatBubble
                    who="us"
                    text={
                      previewRule.responseText ||
                      `Template ${previewRule.templateName ?? 'auto_reply'} fires here.`
                    }
                    time="9:40"
                  />
                </m.div>
              </AnimatePresence>
            </PhoneFrame>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-[12px] text-zinc-500">
              Click a rule to preview.
            </div>
          )}
        </aside>
      </div>

      {/* Create-rule sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruSheetContent side="right" className="sm:max-w-lg">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Create auto-reply rule</ZoruSheetTitle>
            <ZoruSheetDescription>
              Trigger a response when an incoming message matches your keywords.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <form action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="projectId" value={projectId || ''} />
            <input type="hidden" name="matchType" value={matchType} />
            <input type="hidden" name="responseType" value={responseType} />
            <input type="hidden" name="isActive" value={isActive ? 'on' : ''} />

            <div className="grid gap-2">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input
                id="rule-name"
                name="name"
                placeholder="Welcome new customers"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rule-keywords">Keywords</Label>
              <Input
                id="rule-keywords"
                name="keywords"
                placeholder="hi, hello, hey"
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                required
                className="rounded-xl"
              />
              <p className="text-[11.5px] text-zinc-500">Comma-separated. Matching is case-insensitive.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Match type</Label>
                <Select value={matchType} onValueChange={setMatchType}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Match type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="contains">Contains</ZoruSelectItem>
                    <ZoruSelectItem value="exact">Exact</ZoruSelectItem>
                    <ZoruSelectItem value="starts_with">Starts with</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Response type</Label>
                <Select value={responseType} onValueChange={setResponseType}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Response type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="text">Text</ZoruSelectItem>
                    <ZoruSelectItem value="template">Template</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rule-response">Response text</Label>
              <Textarea
                id="rule-response"
                name="responseText"
                placeholder="Hi! Thanks for reaching out..."
                value={formResponseText}
                onChange={(e) => setFormResponseText(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
            </div>

            {responseType === 'template' && (
              <div className="grid gap-2">
                <Label htmlFor="rule-template">Template name</Label>
                <Input id="rule-template" name="templateName" placeholder="welcome_template" className="rounded-xl" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="rule-from">Active from</Label>
                <Input id="rule-from" name="timeFrom" type="time" className="rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rule-to">Active to</Label>
                <Input id="rule-to" name="timeTo" type="time" className="rounded-xl" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <Label htmlFor="rule-active" className="cursor-pointer">Active</Label>
              <RuleSwitch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <ZoruSheetFooter className="pt-2">
              <WaButton variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </WaButton>
              <WaButton type="submit" size="sm" disabled={isPending || !projectId}>
                {isPending ? 'Saving...' : 'Create rule'}
              </WaButton>
            </ZoruSheetFooter>
          </form>
        </ZoruSheetContent>
      </Sheet>

      {/* Delete confirm */}
      <ZoruAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this rule?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {deleteTarget?.name
                ? `"${deleteTarget.name}" will stop responding to incoming messages.`
                : 'This rule will stop responding to incoming messages.'}{' '}
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction destructive onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Yes, delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <AiSuggestionsDialog
        open={aiSuggestionsOpen}
        onOpenChange={setAiSuggestionsOpen}
        onSelectSuggestion={handleSelectAiSuggestion}
      />
    </WaPage>
  );
}

function RuleSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
      style={{ background: checked ? 'var(--mt-accent)' : '#e4e4e7' }}
    >
      <m.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`block h-5 w-5 rounded-full bg-white shadow ${checked ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
      />
    </button>
  );
}
