'use client';

/**
 * SabCRM — multichannel cadence builder (`/dashboard/settings/crm/cadences`).
 *
 * A two-pane editor (mirrors `../scoring/page.tsx`):
 *
 *   LEFT  — the project's cadence templates. Each row shows the name, the
 *           object it targets, its step count and an enabled/off badge.
 *
 *   RIGHT — the editor for the selected template: name, target object, enabled
 *           switch, and an ORDERED list of steps. Each step picks a CHANNEL
 *           (email / sms / whatsapp / task / wait), a delay (hours BEFORE it),
 *           and channel-specific content. EMAIL steps support A/B subject
 *           variants (a deterministic split chooses one per enrollment). Saving
 *           rides the gated `saveCadenceTw`.
 *
 * These templates are the channel-aware companion to the Rust `sabcrm-sequences`
 * engine: the scheduler hands a step here at run time and `dispatchCadenceStep`
 * routes it to SabMail / SabSMS / SabWa / the activities engine.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error.
 */

import * as React from 'react';
import {
  Plus,
  Trash2,
  Send,
  Save,
  X,
  Mail,
  MessageSquare,
  MessageCircle,
  CheckSquare,
  Clock,
  GitBranch,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Textarea,
  Switch,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listCadencesTw,
  saveCadenceTw,
  deleteCadenceTw,
} from '@/app/actions/sabcrm-cadence.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type {
  CadenceChannel,
  CadenceStep,
  CadenceAbVariant,
  CadenceTemplate,
} from '@/lib/sabcrm/cadence-channels';

// ---------------------------------------------------------------------------
// Local wire shapes (kept free of any server-only import)
// ---------------------------------------------------------------------------

interface ObjectOption {
  value: string;
  label: string;
}

/** An editable template draft — `id` absent until first saved. */
interface DraftTemplate {
  id?: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  steps: CadenceStep[];
}

const CHANNELS: ReadonlyArray<{
  value: CadenceChannel;
  label: string;
  icon: typeof Mail;
}> = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'wait', label: 'Wait', icon: Clock },
];

const CHANNEL_ICON: Record<CadenceChannel, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  task: CheckSquare,
  wait: Clock,
};

function genId(prefix = 's'): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function newStep(channel: CadenceChannel = 'email'): CadenceStep {
  return { id: genId('s'), channel, delayHours: channel === 'wait' ? 24 : 0, body: '' };
}
function newVariant(): CadenceAbVariant {
  return { id: genId('v'), subject: '', weight: 1 };
}

function emptyDraft(objectSlug = ''): DraftTemplate {
  return {
    objectSlug,
    name: 'New cadence',
    enabled: true,
    steps: [
      { id: genId('s'), channel: 'email', delayHours: 0, subject: '', body: '' },
    ],
  };
}

export default function CadencesSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [templates, setTemplates] = React.useState<CadenceTemplate[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftTemplate | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Load templates + object list.
  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [setsRes, objsRes] = await Promise.all([
        listCadencesTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (setsRes.ok) setTemplates(setsRes.data);
      else setError(setsRes.error);
      if (objsRes.ok) {
        setObjects(
          objsRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })),
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function selectTemplate(t: CadenceTemplate): void {
    setSelectedId(t.id);
    setDraft({
      id: t.id,
      objectSlug: t.objectSlug,
      name: t.name,
      enabled: t.enabled,
      steps: t.steps.length ? t.steps.map((s) => ({ ...s })) : [newStep()],
    });
  }
  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft(objects[0]?.value ?? ''));
  }
  function patchDraft(patch: Partial<DraftTemplate>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchStep(idx: number, patch: Partial<CadenceStep>): void {
    setDraft((d) =>
      d ? { ...d, steps: d.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)) } : d,
    );
  }
  function moveStep(idx: number, dir: -1 | 1): void {
    setDraft((d) => {
      if (!d) return d;
      const j = idx + dir;
      if (j < 0 || j >= d.steps.length) return d;
      const steps = [...d.steps];
      [steps[idx], steps[j]] = [steps[j], steps[idx]];
      return { ...d, steps };
    });
  }
  function patchVariant(
    stepIdx: number,
    varIdx: number,
    patch: Partial<CadenceAbVariant>,
  ): void {
    setDraft((d) => {
      if (!d) return d;
      const steps = d.steps.map((s, i) => {
        if (i !== stepIdx) return s;
        const variants = (s.variants ?? []).map((v, k) =>
          k === varIdx ? { ...v, ...patch } : v,
        );
        return { ...s, variants };
      });
      return { ...d, steps };
    });
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    if (!draft.objectSlug) {
      toast({ title: 'Pick an object for this cadence.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const res = await saveCadenceTw(
      {
        id: draft.id,
        objectSlug: draft.objectSlug,
        name: draft.name,
        enabled: draft.enabled,
        steps: draft.steps,
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Cadence saved', tone: 'success' });
    const listRes = await listCadencesTw(activeProjectId);
    if (listRes.ok) setTemplates(listRes.data);
    selectTemplate(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteCadenceTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Cadence deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Multichannel cadences</PageTitle>
          <PageDescription>
            Ordered outreach steps across email, SMS, WhatsApp and tasks. Each
            step waits its delay, then fires on its channel; email steps can
            A/B-test the subject line.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New cadence
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_1fr]">
        {/* LEFT — list */}
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No cadences yet"
              description="Create a cadence to start multichannel outreach."
            />
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t)}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedId === t.id
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {t.name}
                  </span>
                  <Badge tone={t.enabled ? 'success' : 'neutral'} kind="soft">
                    {t.enabled ? 'On' : 'Off'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {t.objectSlug} · {t.steps.length} step
                  {t.steps.length === 1 ? '' : 's'}
                </span>
              </button>
            ))
          )}
        </div>

        {/* RIGHT — editor */}
        <div>
          {!draft ? (
            <Card className="p-[var(--st-space-5)]">
              <EmptyState
                icon={GitBranch}
                title="Select or create a cadence"
                description="Each step picks a channel and a delay; the engine runs them in order."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. New lead nurture"
                  />
                </Field>
                <Field label="Object">
                  <Select
                    value={draft.objectSlug}
                    onValueChange={(objectSlug) => patchDraft({ objectSlug })}
                  >
                    <SelectTrigger aria-label="Object">
                      <SelectValue placeholder="Select an object" />
                    </SelectTrigger>
                    <SelectContent>
                      {objects.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex items-center gap-[var(--st-space-3)]">
                <Switch
                  checked={draft.enabled}
                  aria-label="Enable cadence"
                  onCheckedChange={(enabled) => patchDraft({ enabled })}
                />
                <span className="text-[13px] text-[var(--st-text)]">
                  Enabled — available for enrolment
                </span>
              </div>

              {/* Steps */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Steps
                </span>
                {draft.steps.map((step, i) => {
                  const Icon = CHANNEL_ICON[step.channel];
                  return (
                    <div
                      key={step.id}
                      className="flex flex-col gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-3)]"
                    >
                      <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg)] text-[12px] font-semibold text-[var(--st-text-secondary)]">
                          {i + 1}
                        </span>
                        <Field label="Channel" className="min-w-[140px] flex-1">
                          <Select
                            value={step.channel}
                            onValueChange={(channel) =>
                              patchStep(i, {
                                channel: channel as CadenceChannel,
                              })
                            }
                          >
                            <SelectTrigger aria-label="Channel">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHANNELS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Delay (hours before)" className="w-[150px]">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={Number.isFinite(step.delayHours) ? step.delayHours : 0}
                            onChange={(e) =>
                              patchStep(i, { delayHours: Number(e.target.value) })
                            }
                          />
                        </Field>
                        <span className="flex items-center gap-1 text-[12px] text-[var(--st-text-secondary)]">
                          <Icon size={14} aria-hidden /> {step.channel}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <IconButton
                            icon={ChevronUp}
                            label="Move up"
                            variant="ghost"
                            disabled={i === 0}
                            onClick={() => moveStep(i, -1)}
                          />
                          <IconButton
                            icon={ChevronDown}
                            label="Move down"
                            variant="ghost"
                            disabled={i === draft.steps.length - 1}
                            onClick={() => moveStep(i, 1)}
                          />
                          <IconButton
                            icon={Trash2}
                            label="Remove step"
                            variant="ghost"
                            onClick={() =>
                              patchDraft({
                                steps: draft.steps.filter((_, j) => j !== i),
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Channel-specific content */}
                      {step.channel === 'wait' ? (
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                          A pure delay. The cadence pauses for the hours above,
                          then continues to the next step.
                        </p>
                      ) : (
                        <>
                          {step.channel === 'task' && (
                            <Field label="Task title">
                              <Input
                                value={step.title ?? ''}
                                onChange={(e) => patchStep(i, { title: e.target.value })}
                                placeholder="e.g. Call {{firstName}} to follow up"
                              />
                            </Field>
                          )}

                          {step.channel === 'email' && (
                            <EmailStepFields
                              step={step}
                              onPatch={(patch) => patchStep(i, patch)}
                              onPatchVariant={(vi, patch) => patchVariant(i, vi, patch)}
                            />
                          )}

                          <Field
                            label={
                              step.channel === 'task'
                                ? 'Task note'
                                : 'Message body'
                            }
                          >
                            <Textarea
                              rows={3}
                              value={step.body ?? ''}
                              onChange={(e) => patchStep(i, { body: e.target.value })}
                              placeholder={
                                step.channel === 'task'
                                  ? 'Details for the assignee…'
                                  : 'Hi {{firstName}}, …  (use {{field}} tokens)'
                              }
                            />
                          </Field>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() =>
                      patchDraft({ steps: [...draft.steps, newStep('email')] })
                    }
                  >
                    Add email
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Clock}
                    onClick={() =>
                      patchDraft({ steps: [...draft.steps, newStep('wait')] })
                    }
                  >
                    Add wait
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={CheckSquare}
                    onClick={() =>
                      patchDraft({ steps: [...draft.steps, newStep('task')] })
                    }
                  >
                    Add task
                  </Button>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                <Button
                  variant="primary"
                  iconLeft={Save}
                  onClick={save}
                  loading={saving}
                  disabled={saving}
                >
                  Save
                </Button>
                {draft.id && (
                  <Button
                    variant="ghost"
                    iconLeft={Trash2}
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cadence?</AlertDialogTitle>
            <AlertDialogDescription>
              Records already enrolled keep running on the sequence engine. This
              only removes the template. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Email step — subject + A/B variants
// ---------------------------------------------------------------------------

function EmailStepFields({
  step,
  onPatch,
  onPatchVariant,
}: {
  step: CadenceStep;
  onPatch: (patch: Partial<CadenceStep>) => void;
  onPatchVariant: (varIdx: number, patch: Partial<CadenceAbVariant>) => void;
}): React.ReactElement {
  const variants = step.variants ?? [];
  const abOn = variants.length > 0;

  function enableAb(): void {
    onPatch({
      variants: [
        { id: genId('v'), subject: step.subject || '', weight: 1 },
        { id: genId('v'), subject: '', weight: 1 },
      ],
    });
  }
  function disableAb(): void {
    onPatch({ variants: [], subject: variants[0]?.subject || step.subject || '' });
  }
  function addVariant(): void {
    onPatch({ variants: [...variants, newVariant()] });
  }
  function removeVariant(idx: number): void {
    onPatch({ variants: variants.filter((_, j) => j !== idx) });
  }

  return (
    <>
      {!abOn ? (
        <Field label="Subject">
          <div className="flex items-center gap-2">
            <Input
              value={step.subject ?? ''}
              onChange={(e) => onPatch({ subject: e.target.value })}
              placeholder="Subject line  (use {{field}} tokens)"
            />
            <Button variant="ghost" size="sm" onClick={enableAb}>
              A/B test
            </Button>
          </div>
        </Field>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--st-text)]">
              A/B subject variants
            </span>
            <Button variant="ghost" size="sm" onClick={disableAb}>
              Disable A/B
            </Button>
          </div>
          {variants.map((v, vi) => (
            <div key={v.id} className="flex items-end gap-2">
              <Field label={`Variant ${vi + 1}`} className="flex-1">
                <Input
                  value={v.subject}
                  onChange={(e) => onPatchVariant(vi, { subject: e.target.value })}
                  placeholder="Subject line"
                />
              </Field>
              <Field label="Weight" className="w-[90px]">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={Number.isFinite(v.weight) ? v.weight : 1}
                  onChange={(e) => onPatchVariant(vi, { weight: Number(e.target.value) })}
                />
              </Field>
              <IconButton
                icon={Trash2}
                label="Remove variant"
                variant="ghost"
                disabled={variants.length <= 1}
                onClick={() => removeVariant(vi)}
              />
            </div>
          ))}
          <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addVariant}>
            Add variant
          </Button>
        </div>
      )}
    </>
  );
}
