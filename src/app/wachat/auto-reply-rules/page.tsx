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
  useState,
  useTransition,
  startTransition,
} from 'react';
import { Bot, Loader, Plus, Trash2, GripVertical, Wand2 } from 'lucide-react';
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

function SortableRuleRow({
  rule,
  setDeleteTarget,
  index,
}: {
  rule: AutoReplyRule;
  setDeleteTarget: (r: AutoReplyRule) => void;
  index: number;
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
      transition={{ duration: 0.3, delay: 0.02 + index * 0.03, ease: EASE_OUT }}
      className={cn(
        'group grid grid-cols-[24px_minmax(0,1.2fr)_minmax(0,1.4fr)_110px_minmax(0,1.4fr)_96px_36px] items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 transition-colors hover:bg-zinc-50',
        isDragging && 'relative z-10 opacity-60 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="grid h-6 w-6 cursor-grab place-items-center text-zinc-300 transition-colors hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Reorder rule"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-zinc-900">{rule.name}</div>
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
      <div className="truncate text-[12.5px] text-zinc-600">
        {rule.responseText || rule.templateName || '-'}
      </div>
      <StatusPill tone={rule.isActive ? 'live' : 'paused'}>{rule.isActive ? 'Active' : 'Paused'}</StatusPill>
      <button
        type="button"
        onClick={() => setDeleteTarget(rule)}
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

  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <WaPage>
      <PageHeader
        title="Auto-reply rules"
        description="Set up keyword-based auto-reply rules for incoming WhatsApp messages."
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

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <MetricTile label="Total rules" value={totalRules} delay={0.02} />
        <MetricTile label="Active rules" value={activeRules} delay={0.06} />
      </div>

      {/* Rules list */}
      <Section
        title="Rules"
        description="Drag to reorder. First match wins."
        action={isLoading && <Loader className="h-4 w-4 animate-spin text-zinc-400" />}
      >
        {isLoading && rules.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No rules yet"
            description="Create your first auto-reply rule to handle keyword-triggered responses."
            action={
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
            }
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rules.map((r) => r._id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {rules.map((rule, i) => (
                  <SortableRuleRow
                    key={rule._id}
                    rule={rule}
                    index={i}
                    setDeleteTarget={setDeleteTarget}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Section>

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
