'use client';

/**
 * SabBigin deal detail — client island.
 *
 * Owns all interactivity for the deal detail page:
 *   - inline-editable field panel (name, value, probability, closeDate,
 *     description, nextStep) saved through `patchSabbiginDeal`,
 *   - a horizontal stage stepper whose chips route through
 *     `moveSabbiginDealStage` (governance: requiredFields → a small Modal
 *     prompt, pendingApproval → a warning toast),
 *   - win / lost shortcut buttons,
 *   - a notes composer wired to `addCrmNote` via `useActionState`,
 *   - a tabbed body (Overview / Timeline / Notes / Activities / Products /
 *     Files) so the record reads like a real CRM detail.
 */

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  Award,
  Calendar,
  CheckCircle2,
  FileText,
  Handshake,
  ListChecks,
  type LucideIcon,
  Package,
  Pencil,
  Percent,
  ReceiptText,
  StickyNote,
  Trophy,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Modal,
  StatCard,
  TabsBar,
  TabPanel,
  Textarea,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  toast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
  formatCurrency,
  formatDate,
  badgeToneForStage,
  isWonStage,
  isLostStage,
} from '@/components/sabbigin/lib/format';
import {
  EntityTimeline,
  type TimelineItem,
} from '@/components/sabbigin/timeline/entity-timeline';

import {
  patchSabbiginDeal,
  moveSabbiginDealStage,
} from '@/app/actions/sabbigin-deals.actions';
import { addCrmNote } from '@/app/actions/crm.actions';

export interface DealStageOption {
  id: string;
  name: string;
  probability: number | null;
}

export interface DealProductLine {
  name: string;
  quantity: number;
  price: number;
}

export interface DealDetailProps {
  dealId: string;
  pipelineId: string;
  name: string;
  value: number;
  currency: string;
  stage: string;
  probability: number | null;
  closeDate: string | null;
  description: string;
  nextStep: string;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  ownerId: string | null;
  contactId: string | null;
  contactName: string | null;
  products: DealProductLine[];
  stages: DealStageOption[];
  counts: {
    quotations: number;
    invoices: number;
    tasks: number;
    tickets: number;
    contacts: number;
  };
  timeline: TimelineItem[];
}

type FieldKey = 'value' | 'probability' | 'closeDate' | 'description' | 'nextStep';

const FIELD_LABELS: Record<string, string> = {
  name: 'Deal name',
  value: 'Deal value',
  probability: 'Probability',
  closeDate: 'Expected close date',
  description: 'Description',
  nextStep: 'Next step',
};

const noteInitial: { message?: string; error?: string; note?: { content: string; author: string; createdAt: string } } = {};

export function DealDetailClient(props: DealDetailProps): React.JSX.Element {
  const router = useRouter();
  const [tab, setTab] = React.useState('overview');

  // --- local editable state (optimistic, re-synced from props) ---------
  const [name, setName] = React.useState(props.name);
  const [value, setValue] = React.useState(props.value);
  const [probability, setProbability] = React.useState<number | null>(props.probability);
  const [closeDate, setCloseDate] = React.useState<string | null>(props.closeDate);
  const [description, setDescription] = React.useState(props.description);
  const [nextStep, setNextStep] = React.useState(props.nextStep);
  const [stage, setStage] = React.useState(props.stage);
  const [timeline, setTimeline] = React.useState<TimelineItem[]>(props.timeline);

  const [savingField, setSavingField] = React.useState<string | null>(null);
  const [movingStage, setMovingStage] = React.useState<string | null>(null);

  // required-field modal (governance gate)
  const [gate, setGate] = React.useState<{
    toStage: string;
    fields: string[];
    values: Record<string, string>;
  } | null>(null);

  // notes composer (useActionState)
  const [noteState, noteAction, notePending] = useActionState(addCrmNote, noteInitial);
  const noteFormRef = React.useRef<HTMLFormElement>(null);

  // Append a freshly-saved note to the local timeline so it appears at once.
  const lastNoteRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (noteState?.note && noteState.note.createdAt !== lastNoteRef.current) {
      lastNoteRef.current = noteState.note.createdAt;
      setTimeline((prev) => [
        {
          id: `note-${noteState.note!.createdAt}`,
          type: 'note',
          title: 'Note added',
          body: noteState.note!.content,
          timestamp: noteState.note!.createdAt,
          actorName: noteState.note!.author,
        },
        ...prev,
      ]);
      noteFormRef.current?.reset();
      toast.success({ title: 'Note added' });
      router.refresh();
    } else if (noteState?.error) {
      toast.error({ title: 'Could not add note', description: noteState.error });
    }
  }, [noteState, router]);

  /* ---------------------------------------------------------- field save */
  const saveField = React.useCallback(
    async (key: FieldKey, raw: string | number | null) => {
      setSavingField(key);
      const patch: Record<string, string | number | null> = { [key]: raw };
      const r = await patchSabbiginDeal(props.dealId, patch);
      setSavingField(null);
      if (!r.success) {
        toast.error({ title: 'Could not save', description: r.error });
        return false;
      }
      toast.success({ title: `${FIELD_LABELS[key] ?? 'Field'} saved` });
      router.refresh();
      return true;
    },
    [props.dealId, router],
  );

  /* ------------------------------------------------------------ name save */
  const [editingName, setEditingName] = React.useState(false);
  const saveName = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === props.name) {
      setEditingName(false);
      setName(props.name);
      return;
    }
    setSavingField('name');
    const r = await patchSabbiginDeal(props.dealId, { name: trimmed });
    setSavingField(null);
    setEditingName(false);
    if (!r.success) {
      toast.error({ title: 'Could not rename deal', description: r.error });
      setName(props.name);
      return;
    }
    toast.success({ title: 'Deal renamed' });
    router.refresh();
  }, [name, props.name, props.dealId, router]);

  /* ----------------------------------------------------------- stage move */
  const doMove = React.useCallback(
    async (toStage: string, extra?: Record<string, string>) => {
      if (!toStage || toStage === stage) return;
      setMovingStage(toStage);
      const r = await moveSabbiginDealStage(props.dealId, toStage, extra);
      setMovingStage(null);

      if (r.success) {
        setStage(toStage);
        setGate(null);
        setTimeline((prev) => [
          {
            id: `stage-${Date.now()}`,
            type: 'stage',
            title: `Moved to ${toStage}`,
            timestamp: new Date().toISOString(),
            actorName: 'You',
          },
          ...prev,
        ]);
        toast.success({ title: `Moved to ${toStage}` });
        router.refresh();
        return;
      }

      if (r.requiredFields && r.requiredFields.length) {
        // open the gate prompt for the missing fields
        const seed: Record<string, string> = {};
        for (const f of r.requiredFields) seed[f] = '';
        setGate({ toStage, fields: r.requiredFields, values: seed });
        toast.warning({
          title: 'A few details first',
          description: `Fill ${r.requiredFields.length} required field${r.requiredFields.length === 1 ? '' : 's'} to move to ${toStage}.`,
        });
        return;
      }

      if (r.pendingApproval) {
        toast.warning({
          title: 'Approval requested',
          description: `Moving to ${toStage} needs sign-off. The move is frozen until it's approved.`,
        });
        router.refresh();
        return;
      }

      toast.error({ title: 'Could not move deal', description: r.error });
    },
    [stage, props.dealId, router],
  );

  const submitGate = React.useCallback(async () => {
    if (!gate) return;
    const missing = gate.fields.filter((f) => !String(gate.values[f] ?? '').trim());
    if (missing.length) {
      toast.error({
        title: 'Still missing details',
        description: `Please fill: ${missing.map((m) => FIELD_LABELS[m] ?? m).join(', ')}.`,
      });
      return;
    }
    await doMove(gate.toStage, gate.values);
  }, [gate, doMove]);

  /* ------------------------------------------------------ file attachment */
  const onFilePicked = React.useCallback(
    (pick: SabFilePick) => {
      setTimeline((prev) => [
        {
          id: `file-${pick.id}-${Date.now()}`,
          type: 'file',
          title: 'File attached',
          body: pick.name,
          timestamp: new Date().toISOString(),
          actorName: 'You',
        },
        ...prev,
      ]);
      toast.success({ title: 'File attached', description: pick.name });
    },
    [],
  );

  const weighted = value * ((probability ?? 0) / 100);
  const stageTone = badgeToneForStage(stage);
  const currentIndex = props.stages.findIndex((s) => s.name === stage);

  const tabItems = [
    { value: 'overview', label: 'Overview', icon: Pencil as LucideIcon },
    { value: 'timeline', label: 'Timeline', icon: Activity as LucideIcon, badge: timeline.length || undefined },
    { value: 'notes', label: 'Notes', icon: StickyNote as LucideIcon },
    { value: 'activities', label: 'Activities', icon: ListChecks as LucideIcon, badge: props.counts.tasks || undefined },
    { value: 'products', label: 'Products', icon: Package as LucideIcon, badge: props.products.length || undefined },
    { value: 'files', label: 'Files', icon: FileText as LucideIcon },
  ];

  return (
    <div className="flex w-full flex-col gap-5">
      {/* ── header card ─────────────────────────────────────────────── */}
      <Card padding="none">
        <CardHeader>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-subtle)] text-[var(--st-text-secondary)]"
            >
              <Handshake size={18} />
            </span>
            <div className="min-w-0 flex-1">
              {editingName ? (
                <Input
                  autoFocus
                  inputSize="sm"
                  value={name}
                  aria-label="Deal name"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveName();
                    } else if (e.key === 'Escape') {
                      setEditingName(false);
                      setName(props.name);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="group flex items-center gap-1.5 text-left"
                  onClick={() => setEditingName(true)}
                >
                  <CardTitle>{name}</CardTitle>
                  <Pencil
                    size={13}
                    className="opacity-0 transition-opacity group-hover:opacity-60"
                    aria-hidden="true"
                  />
                </button>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                <Badge tone={stageTone} kind="soft">
                  {stage}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Wallet size={12} aria-hidden="true" />
                  {formatCurrency(value, props.currency)}
                </span>
                {props.contactName ? (
                  <span className="inline-flex items-center gap-1">
                    <User size={12} aria-hidden="true" />
                    {props.contactId ? (
                      <Link
                        href={`/dashboard/sabbigin/contacts/${props.contactId}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {props.contactName}
                      </Link>
                    ) : (
                      props.contactName
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Trophy size={14} />}
              loading={movingStage != null && isWonStage(movingStage)}
              disabled={isWonStage(stage)}
              onClick={() => {
                const won = props.stages.find((s) => isWonStage(s.name));
                void doMove(won?.name ?? 'Won');
              }}
            >
              Mark won
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<XCircle size={14} />}
              loading={movingStage != null && isLostStage(movingStage)}
              disabled={isLostStage(stage)}
              onClick={() => {
                const lost = props.stages.find((s) => isLostStage(s.name));
                void doMove(lost?.name ?? 'Lost');
              }}
            >
              Mark lost
            </Button>
          </div>
        </CardHeader>

        {/* ── stage stepper ─────────────────────────────────────────── */}
        <CardBody className="pt-0">
          <div
            className="flex w-full items-stretch gap-1 overflow-x-auto pb-1"
            role="group"
            aria-label="Pipeline stage"
          >
            {props.stages.map((s, i) => {
              const isCurrent = s.name === stage;
              const isPast = currentIndex >= 0 && i < currentIndex;
              const isMoving = movingStage === s.name;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isMoving}
                  onClick={() => void doMove(s.name)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'relative flex min-w-[120px] flex-1 flex-col items-start justify-center gap-0.5 rounded-[var(--st-radius)] border px-3 py-2 text-left text-xs transition-colors',
                    isCurrent
                      ? 'border-[var(--st-accent)] bg-[var(--st-accent-subtle,rgba(59,122,245,0.10))] text-[var(--st-text)]'
                      : isPast
                        ? 'border-[var(--st-border)] bg-[var(--st-bg-subtle)] text-[var(--st-text-secondary)]'
                        : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-tertiary)] hover:border-[var(--st-text)]/30',
                    isMoving ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="truncate font-medium">{s.name}</span>
                    {isCurrent ? (
                      <CheckCircle2 size={13} className="shrink-0 text-[var(--st-accent)]" aria-hidden="true" />
                    ) : null}
                  </span>
                  {s.probability != null ? (
                    <span className="text-[11px] text-[var(--st-text-tertiary)]">
                      {s.probability}% win
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:max-w-2xl">
        <StatCard label="Value" value={formatCurrency(value, props.currency)} icon={Wallet} accent="#1f9d55" />
        <StatCard
          label="Probability"
          value={probability != null ? `${probability}%` : '—'}
          icon={Percent}
          accent="#a855f7"
        />
        <StatCard label="Weighted" value={formatCurrency(weighted, props.currency)} icon={Award} accent="#3b7af5" />
        <StatCard
          label="Close date"
          value={closeDate ? formatDate(closeDate) : '—'}
          icon={Calendar}
          accent="#f59e0b"
        />
      </div>

      {/* ── tabbed body ─────────────────────────────────────────────── */}
      <Card padding="none">
        <TabsBar items={tabItems} value={tab} onChange={setTab} idBase="deal-detail">
          {/* Overview — editable fields */}
          <TabPanel value="overview">
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              <Field label={FIELD_LABELS.value}>
                <Input
                  type="number"
                  inputMode="decimal"
                  prefix={props.currency}
                  value={Number.isFinite(value) ? value : 0}
                  disabled={savingField === 'value'}
                  onChange={(e) => setValue(Number(e.target.value))}
                  onBlur={() => {
                    if (value !== props.value) void saveField('value', value);
                  }}
                />
              </Field>

              <Field label={FIELD_LABELS.probability} help="0–100% chance of winning.">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  suffix="%"
                  value={probability ?? ''}
                  disabled={savingField === 'probability'}
                  onChange={(e) =>
                    setProbability(e.target.value === '' ? null : Number(e.target.value))
                  }
                  onBlur={() => {
                    if ((probability ?? null) !== (props.probability ?? null)) {
                      void saveField('probability', probability);
                    }
                  }}
                />
              </Field>

              <Field label={FIELD_LABELS.closeDate}>
                <Input
                  type="date"
                  value={closeDate ? closeDate.slice(0, 10) : ''}
                  disabled={savingField === 'closeDate'}
                  onChange={(e) => setCloseDate(e.target.value || null)}
                  onBlur={() => {
                    const next = closeDate ? closeDate.slice(0, 10) : '';
                    const prev = props.closeDate ? props.closeDate.slice(0, 10) : '';
                    if (next !== prev) void saveField('closeDate', closeDate);
                  }}
                />
              </Field>

              <Field label="Next step">
                <Input
                  value={nextStep}
                  placeholder="e.g. Send proposal Friday"
                  disabled={savingField === 'nextStep'}
                  onChange={(e) => setNextStep(e.target.value)}
                  onBlur={() => {
                    if (nextStep !== props.nextStep) void saveField('nextStep', nextStep);
                  }}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label={FIELD_LABELS.description}>
                  <Textarea
                    rows={4}
                    value={description}
                    placeholder="Context, scope, or anything the team should know about this deal."
                    disabled={savingField === 'description'}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => {
                      if (description !== props.description) {
                        void saveField('description', description);
                      }
                    }}
                  />
                </Field>
              </div>
            </div>
          </TabPanel>

          {/* Timeline */}
          <TabPanel value="timeline">
            <div className="p-4">
              <EntityTimeline items={timeline} />
            </div>
          </TabPanel>

          {/* Notes */}
          <TabPanel value="notes">
            <div className="flex flex-col gap-4 p-4">
              <form ref={noteFormRef} action={noteAction} className="flex flex-col gap-2">
                <input type="hidden" name="recordId" value={props.dealId} />
                <input type="hidden" name="recordType" value="deal" />
                <Field label="Add a note">
                  <Textarea
                    name="noteContent"
                    rows={3}
                    required
                    placeholder="Log a call summary, an objection, a commitment…"
                  />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm" loading={notePending}>
                    Add note
                  </Button>
                </div>
              </form>

              <div className="border-t border-[var(--st-border)] pt-4">
                <EntityTimeline
                  items={timeline.filter((t) => {
                    const type = String(t.type ?? '').toLowerCase();
                    return type === 'note' || type === 'comment';
                  })}
                  emptyTitle="No notes yet"
                  emptyDescription="Notes you add appear here and in the timeline."
                />
              </div>
            </div>
          </TabPanel>

          {/* Activities */}
          <TabPanel value="activities">
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CountTile icon={ListChecks} label="Tasks" value={props.counts.tasks} />
                <CountTile icon={ReceiptText} label="Quotations" value={props.counts.quotations} />
                <CountTile icon={FileText} label="Invoices" value={props.counts.invoices} />
                <CountTile icon={Activity} label="Tickets" value={props.counts.tickets} />
              </div>
              {props.counts.tasks === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={ListChecks}
                    title="No open activities"
                    description="Tasks generated from stage moves and follow-ups will appear here."
                    size="sm"
                  />
                </div>
              ) : null}
            </div>
          </TabPanel>

          {/* Products */}
          <TabPanel value="products">
            <div className="p-4">
              {props.products.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No line items"
                  description="Add products or services to itemise this deal's value."
                  size="sm"
                />
              ) : (
                <Table>
                  <THead>
                    <Tr>
                      <Th>Item</Th>
                      <Th align="right">Qty</Th>
                      <Th align="right">Unit price</Th>
                      <Th align="right">Line total</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {props.products.map((p, i) => (
                      <Tr key={`${p.name}-${i}`}>
                        <Td>{p.name}</Td>
                        <Td align="right">{p.quantity}</Td>
                        <Td align="right">{formatCurrency(p.price, props.currency)}</Td>
                        <Td align="right">
                          {formatCurrency(p.price * p.quantity, props.currency)}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </TabPanel>

          {/* Files */}
          <TabPanel value="files">
            <div className="flex flex-col items-start gap-3 p-4">
              <p className="text-sm text-[var(--st-text-secondary)]">
                Attach proposals, contracts or supporting docs from your SabFiles library.
              </p>
              <SabFilePickerButton onPick={onFilePicked}>
                Attach a file
              </SabFilePickerButton>
              {timeline.filter((t) => String(t.type ?? '').toLowerCase() === 'file').length === 0 ? (
                <div className="w-full">
                  <EmptyState
                    icon={FileText}
                    title="No files attached"
                    description="Files you attach are logged on the timeline."
                    size="sm"
                  />
                </div>
              ) : (
                <ul className="w-full divide-y divide-[var(--st-border)] rounded-[var(--st-radius)] border border-[var(--st-border)]">
                  {timeline
                    .filter((t) => String(t.type ?? '').toLowerCase() === 'file')
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <FileText size={14} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                        <span className="truncate">{t.body ?? t.title}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </TabPanel>
        </TabsBar>
      </Card>

      {/* ── required-field gate modal ───────────────────────────────── */}
      <Modal
        open={gate != null}
        onClose={() => setGate(null)}
        title={`Move to ${gate?.toStage ?? ''}`}
        description="This stage needs a few details before the deal can move."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setGate(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={movingStage === gate?.toStage}
              onClick={() => void submitGate()}
            >
              Save &amp; move
            </Button>
          </div>
        }
      >
        {gate ? (
          <div className="flex flex-col gap-3">
            {gate.fields.map((f) => (
              <Field key={f} label={FIELD_LABELS[f] ?? f} required>
                {f === 'closeDate' ? (
                  <Input
                    type="date"
                    value={gate.values[f] ?? ''}
                    onChange={(e) =>
                      setGate((g) =>
                        g ? { ...g, values: { ...g.values, [f]: e.target.value } } : g,
                      )
                    }
                  />
                ) : f === 'value' || f === 'probability' ? (
                  <Input
                    type="number"
                    value={gate.values[f] ?? ''}
                    onChange={(e) =>
                      setGate((g) =>
                        g ? { ...g, values: { ...g.values, [f]: e.target.value } } : g,
                      )
                    }
                  />
                ) : (
                  <Input
                    value={gate.values[f] ?? ''}
                    onChange={(e) =>
                      setGate((g) =>
                        g ? { ...g, values: { ...g.values, [f]: e.target.value } } : g,
                      )
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function CountTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-subtle)] text-[var(--st-text-secondary)]">
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none text-[var(--st-text)]">{value}</p>
        <p className="mt-0.5 text-xs text-[var(--st-text-tertiary)]">{label}</p>
      </div>
    </div>
  );
}

export default DealDetailClient;
