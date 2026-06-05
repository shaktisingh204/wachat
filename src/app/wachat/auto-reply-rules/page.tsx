'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  StatCard,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  startTransition,
  } from 'react';
import { Bot,
  Plus,
  Trash2, GripVertical, Wand2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
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

// Sortable Row Component
function SortableRuleRow({ rule, setDeleteTarget }: { rule: AutoReplyRule; setDeleteTarget: (r: AutoReplyRule) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule._id });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Tr
      ref={setNodeRef}
      style={dragStyle}
      className={isDragging ? 'relative z-10 opacity-50 bg-[var(--st-bg-secondary)]' : undefined}
    >
      <Td className="w-10">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab transition-colors text-[var(--st-text-tertiary)]"
        >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
        </div>
      </Td>
      <Td className="text-[13px] text-[var(--st-text)]">
        {rule.name}
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {(rule.keywords || []).slice(0, 3).map((kw) => (
            <Badge key={kw} tone="neutral">
              {kw}
            </Badge>
          ))}
          {(rule.keywords || []).length > 3 && (
            <Badge kind="outline">
              +{(rule.keywords || []).length - 3}
            </Badge>
          )}
        </div>
      </Td>
      <Td className="text-[13px] text-[var(--st-text-secondary)]">
        {rule.matchType}
      </Td>
      <Td truncate className="max-w-[200px] text-[13px] text-[var(--st-text-secondary)]">
        {rule.responseText || rule.templateName || '-'}
      </Td>
      <Td>
        <Badge tone={rule.isActive ? 'success' : 'neutral'}>
          {rule.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Td>
      <Td align="right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteTarget(rule)}
          aria-label="Delete rule"
          iconLeft={Trash2}
        />
      </Td>
    </Tr>
  );
}

export default function AutoReplyRulesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
          toast({ title: 'Error', description: res.error, tone: 'danger' });
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
      toast({ title: 'Saved', description: formState.message, tone: 'success' });
      setCreateOpen(false);
      // Reset form states
      setFormName('');
      setFormKeywords('');
      setFormResponseText('');
      setResponseType('text');
      setMatchType('contains');
      setIsActive(true);
      if (projectId) fetchRules(projectId);
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, tone: 'danger' });
    }
  }, [formState, toast, projectId, fetchRules]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDeleting(async () => {
      const res = await deleteAutoReplyRule(target._id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
      } else {
        setRules((prev) => prev.filter((r) => r._id !== target._id));
        toast({ title: 'Deleted', description: 'Rule removed.' });
      }
      setDeleteTarget(null);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5, // 5px drag tolerance
        }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRules((items) => {
        const oldIndex = items.findIndex((i) => i._id === active.id);
        const newIndex = items.findIndex((i) => i._id === over.id);

        // Optimistic UI update
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Fire off a server action to save the new sort order.
        startTransition(() => {
          updateAutoReplyRuleOrder(newItems.map(i => i._id));
        });

        return newItems;
      });
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormKeywords('');
    setFormResponseText('');
    setResponseType('text');
    setMatchType('contains');
    setIsActive(true);
  };

  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Auto-Reply Rules' },
      ]}
      title="Auto-Reply Rules"
      description="Set up keyword-based auto-reply rules for incoming WhatsApp messages."
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAiSuggestionsOpen(true)}
            disabled={!projectId}
            iconLeft={Wand2}
          >
            AI Suggestions
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            disabled={!projectId}
            iconLeft={Plus}
          >
            Create rule
          </Button>
        </>
      }
    >
      {/* Stats */}
      <div className="grid max-w-md grid-cols-2 gap-3">
        <StatCard label="Total rules" value={totalRules} />
        <StatCard label="Active rules" value={activeRules} />
      </div>

      {/* Rules list */}
      <Card padding="none" className="mt-6">
        <CardHeader className="flex items-center justify-between px-5 pt-5 pb-4">
          <CardTitle>Rules</CardTitle>
          {isLoading && <Spinner size="sm" label="Loading rules" />}
        </CardHeader>
        <CardBody className="px-5 pb-5">
        {isLoading && rules.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner label="Loading rules" />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No rules yet"
            description="Create your first auto-reply rule to handle keyword-triggered responses."
            action={
              <Button
                size="sm"
                variant="primary"
                iconLeft={Plus}
                onClick={() => {
                  resetForm();
                  setCreateOpen(true);
                }}
              >
                Create rule
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th className="w-10"></Th>
                <Th>Name</Th>
                <Th>Keywords</Th>
                <Th>Match</Th>
                <Th>Response</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </Tr>
            </THead>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <TBody>
                    <SortableContext
                        items={rules.map((r) => r._id)}
                        strategy={verticalListSortingStrategy}
                    >
                    {rules.map((rule) => (
                        <SortableRuleRow key={rule._id} rule={rule} setDeleteTarget={setDeleteTarget} />
                    ))}
                    </SortableContext>
                </TBody>
            </DndContext>
          </Table>
        )}
        </CardBody>
      </Card>

      {/* Create-rule drawer */}
      <Drawer open={createOpen} onOpenChange={setCreateOpen} side="right">
        <DrawerContent side="right" closeLabel="Close" className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Create auto-reply rule</DrawerTitle>
            <DrawerDescription>
              Trigger a response when an incoming message matches your keywords.
            </DrawerDescription>
          </DrawerHeader>

          <form action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="projectId" value={projectId || ''} />
            <input type="hidden" name="matchType" value={matchType} />
            <input type="hidden" name="responseType" value={responseType} />
            <input type="hidden" name="isActive" value={isActive ? 'on' : ''} />

            <Field label="Rule name">
              <Input id="rule-name" name="name" placeholder="Welcome new customers" value={formName} onChange={e => setFormName(e.target.value)} required />
            </Field>

            <Field
              label="Keywords"
              help="Comma-separated. Matching is case-insensitive."
            >
              <Input
                id="rule-keywords"
                name="keywords"
                placeholder="hi, hello, hey"
                value={formKeywords}
                onChange={e => setFormKeywords(e.target.value)}
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Match type">
                <Select
                  value={matchType}
                  onChange={(v) => setMatchType(v ?? 'contains')}
                  placeholder="Match type"
                  options={[
                    { value: 'contains', label: 'Contains' },
                    { value: 'exact', label: 'Exact' },
                    { value: 'starts_with', label: 'Starts with' },
                  ]}
                />
              </Field>
              <Field label="Response type">
                <Select
                  value={responseType}
                  onChange={(v) => setResponseType(v ?? 'text')}
                  placeholder="Response type"
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'template', label: 'Template' },
                  ]}
                />
              </Field>
            </div>

            <Field label="Response text">
              <Textarea
                id="rule-response"
                name="responseText"
                placeholder="Hi! Thanks for reaching out..."
                value={formResponseText}
                onChange={e => setFormResponseText(e.target.value)}
                rows={3}
              />
            </Field>

            {responseType === 'template' && (
              <Field label="Template name">
                <Input
                  id="rule-template"
                  name="templateName"
                  placeholder="welcome_template"
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Active from">
                <Input id="rule-from" name="timeFrom" type="time" />
              </Field>
              <Field label="Active to">
                <Input id="rule-to" name="timeTo" type="time" />
              </Field>
            </div>

            <Switch
              id="rule-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              label="Active"
            />

            <DrawerFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isPending} disabled={isPending || !projectId}>
                {isPending ? 'Saving…' : 'Create rule'}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Delete-rule confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name
                ? `“${deleteTarget.name}” will stop responding to incoming messages.`
                : 'This rule will stop responding to incoming messages.'}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiSuggestionsDialog
        open={aiSuggestionsOpen}
        onOpenChange={setAiSuggestionsOpen}
        onSelectSuggestion={handleSelectAiSuggestion}
      />
    </WachatPage>
  );
}
