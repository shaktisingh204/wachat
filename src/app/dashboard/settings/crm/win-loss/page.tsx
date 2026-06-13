'use client';

/**
 * SabCRM — Win/loss reasons settings (`/dashboard/settings/crm/win-loss`).
 *
 * A two-pane editor (mirrors `../scoring/page.tsx`):
 *
 *   LEFT  — one win/loss config per object. Each row shows the object slug, the
 *           won/lost stage counts and whether reasons are required. "New" starts
 *           a draft for an object that doesn't yet have a config.
 *
 *   RIGHT — the editor for the selected config: the object, the WON and LOST
 *           stage lists, the "require a reason" switches and the allowed
 *           win/loss reason option lists. Enabling provisions `outcome`,
 *           `winReason` and `lossReason` SELECT fields on the object and
 *           persists the config via the gated `enableWinLossTw`.
 *
 * When a deal record changes stage, the create/update action calls
 * `captureOutcome`, which classifies the new stage against this config and
 * stamps `data.outcome` / `data.outcomeAt` onto the record (no `updatedAt`
 * bump).
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { Plus, Trash2, Flag, Save, X } from 'lucide-react';

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
  listWinLossConfigsTw,
  enableWinLossTw,
  deleteWinLossConfigTw,
} from '@/app/actions/sabcrm-winloss.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type {
  WinLossConfig,
  WinLossReasonOption,
} from '@/lib/sabcrm/win-loss';

// ---------------------------------------------------------------------------
// Local wire shapes (kept free of any server-only import)
// ---------------------------------------------------------------------------

interface ObjectOption {
  value: string;
  label: string;
}

/** An editable config draft. */
interface DraftConfig {
  objectSlug: string;
  wonStages: string[];
  lostStages: string[];
  requireWonReason: boolean;
  requireLostReason: boolean;
  winReasonOptions: WinLossReasonOption[];
  lossReasonOptions: WinLossReasonOption[];
}

function emptyDraft(objectSlug = ''): DraftConfig {
  return {
    objectSlug,
    wonStages: ['Closed Won'],
    lostStages: ['Closed Lost'],
    requireWonReason: false,
    requireLostReason: true,
    winReasonOptions: [],
    lossReasonOptions: [
      { value: 'too_expensive', label: 'Too expensive' },
      { value: 'competitor', label: 'Lost to competitor' },
      { value: 'no_decision', label: 'No decision / timing' },
    ],
  };
}

/** Slugify a label into a stable SELECT option value. */
function slugifyValue(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || label.trim().toLowerCase()
  );
}

/** Comma/newline-separated text → trimmed string list. */
function parseStageList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function configToDraft(c: WinLossConfig): DraftConfig {
  return {
    objectSlug: c.objectSlug,
    wonStages: [...c.wonStages],
    lostStages: [...c.lostStages],
    requireWonReason: c.requireWonReason,
    requireLostReason: c.requireLostReason,
    winReasonOptions: c.winReasonOptions.map((o) => ({ ...o })),
    lossReasonOptions: c.lossReasonOptions.map((o) => ({ ...o })),
  };
}

export default function WinLossSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [configs, setConfigs] = React.useState<WinLossConfig[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftConfig | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [cfgRes, objsRes] = await Promise.all([
        listWinLossConfigsTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (cfgRes.ok) setConfigs(cfgRes.data);
      else setError(cfgRes.error);
      if (objsRes.ok) {
        setObjects(
          objsRes.data.map((o) => ({
            value: o.slug,
            label: o.labelPlural || o.slug,
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function selectConfig(c: WinLossConfig): void {
    setSelectedSlug(c.objectSlug);
    setDraft(configToDraft(c));
  }
  function startNew(): void {
    const used = new Set(configs.map((c) => c.objectSlug));
    const firstFree = objects.find((o) => !used.has(o.value))?.value ?? '';
    setSelectedSlug(null);
    setDraft(emptyDraft(firstFree));
  }
  function patchDraft(patch: Partial<DraftConfig>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchWinOption(idx: number, patch: Partial<WinLossReasonOption>): void {
    setDraft((d) =>
      d
        ? {
            ...d,
            winReasonOptions: d.winReasonOptions.map((o, i) =>
              i === idx ? { ...o, ...patch } : o,
            ),
          }
        : d,
    );
  }
  function patchLossOption(idx: number, patch: Partial<WinLossReasonOption>): void {
    setDraft((d) =>
      d
        ? {
            ...d,
            lossReasonOptions: d.lossReasonOptions.map((o, i) =>
              i === idx ? { ...o, ...patch } : o,
            ),
          }
        : d,
    );
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    if (!draft.objectSlug) {
      toast({ title: 'Pick an object.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const res = await enableWinLossTw(
      {
        objectSlug: draft.objectSlug,
        wonStages: draft.wonStages,
        lostStages: draft.lostStages,
        requireWonReason: draft.requireWonReason,
        requireLostReason: draft.requireLostReason,
        winReasonOptions: draft.winReasonOptions
          .filter((o) => o.label.trim())
          .map((o) => ({
            value: o.value.trim() || slugifyValue(o.label),
            label: o.label.trim(),
            color: o.color?.trim() || undefined,
          })),
        lossReasonOptions: draft.lossReasonOptions
          .filter((o) => o.label.trim())
          .map((o) => ({
            value: o.value.trim() || slugifyValue(o.label),
            label: o.label.trim(),
            color: o.color?.trim() || undefined,
          })),
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Win/loss capture enabled',
      description: 'Outcome and reason fields were provisioned on the object.',
      tone: 'success',
    });
    const listRes = await listWinLossConfigsTw(activeProjectId);
    if (listRes.ok) setConfigs(listRes.data);
    selectConfig(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.objectSlug || !activeProjectId || selectedSlug === null) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteWinLossConfigTw(draft.objectSlug, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setConfigs((prev) => prev.filter((c) => c.objectSlug !== draft.objectSlug));
    setDraft(null);
    setSelectedSlug(null);
    toast({ title: 'Win/loss config deleted', tone: 'success' });
  }

  const objectLabel = (slug: string): string =>
    objects.find((o) => o.value === slug)?.label ?? slug;

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Win/loss reasons</PageTitle>
          <PageDescription>
            When a deal changes stage, classify it as won, lost or open and
            require a structured reason. The outcome is stamped onto the record
            automatically.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New config
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
          ) : configs.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="No win/loss config yet"
              description="Add a config to start capturing outcomes per object."
            />
          ) : (
            configs.map((c) => (
              <button
                key={c.objectSlug}
                type="button"
                onClick={() => selectConfig(c)}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedSlug === c.objectSlug
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {objectLabel(c.objectSlug)}
                  </span>
                  <Badge
                    tone={
                      c.requireWonReason || c.requireLostReason
                        ? 'warning'
                        : 'neutral'
                    }
                    kind="soft"
                  >
                    {c.requireWonReason || c.requireLostReason
                      ? 'Reason required'
                      : 'Optional'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {c.wonStages.length} won · {c.lostStages.length} lost stage
                  {c.lostStages.length === 1 ? '' : 's'}
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
                icon={Flag}
                title="Select or create a win/loss config"
                description="Map stages to won/lost outcomes and require a reason on close."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <Field label="Object">
                <Select
                  value={draft.objectSlug}
                  onValueChange={(objectSlug) => patchDraft({ objectSlug })}
                  disabled={selectedSlug !== null}
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

              {/* Stage lists */}
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field
                  label="Won stages"
                  help="Comma or newline separated. e.g. Closed Won"
                >
                  <Input
                    value={draft.wonStages.join(', ')}
                    onChange={(e) =>
                      patchDraft({ wonStages: parseStageList(e.target.value) })
                    }
                    placeholder="Closed Won"
                  />
                </Field>
                <Field
                  label="Lost stages"
                  help="Comma or newline separated. e.g. Closed Lost"
                >
                  <Input
                    value={draft.lostStages.join(', ')}
                    onChange={(e) =>
                      patchDraft({ lostStages: parseStageList(e.target.value) })
                    }
                    placeholder="Closed Lost"
                  />
                </Field>
              </div>

              {/* Require switches */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <div className="flex items-center gap-[var(--st-space-3)]">
                  <Switch
                    checked={draft.requireWonReason}
                    aria-label="Require a win reason"
                    onCheckedChange={(requireWonReason) =>
                      patchDraft({ requireWonReason })
                    }
                  />
                  <span className="text-[13px] text-[var(--st-text)]">
                    Require a reason when a deal is won
                  </span>
                </div>
                <div className="flex items-center gap-[var(--st-space-3)]">
                  <Switch
                    checked={draft.requireLostReason}
                    aria-label="Require a loss reason"
                    onCheckedChange={(requireLostReason) =>
                      patchDraft({ requireLostReason })
                    }
                  />
                  <span className="text-[13px] text-[var(--st-text)]">
                    Require a reason when a deal is lost
                  </span>
                </div>
              </div>

              {/* Win reasons */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Win reasons
                </span>
                {draft.winReasonOptions.length === 0 && (
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    No win reasons — any non-empty reason is accepted.
                  </span>
                )}
                {draft.winReasonOptions.map((opt, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                  >
                    <Field label="Label" className="min-w-[160px] flex-1">
                      <Input
                        value={opt.label}
                        onChange={(e) =>
                          patchWinOption(i, { label: e.target.value })
                        }
                        placeholder="e.g. Best price"
                      />
                    </Field>
                    <Field label="Color" className="min-w-[120px] flex-1">
                      <Input
                        value={opt.color ?? ''}
                        onChange={(e) =>
                          patchWinOption(i, { color: e.target.value })
                        }
                        placeholder="success / #22c55e"
                      />
                    </Field>
                    <IconButton
                      icon={X}
                      label="Remove win reason"
                      variant="ghost"
                      onClick={() =>
                        patchDraft({
                          winReasonOptions: draft.winReasonOptions.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() =>
                    patchDraft({
                      winReasonOptions: [
                        ...draft.winReasonOptions,
                        { value: '', label: '', color: '' },
                      ],
                    })
                  }
                >
                  Add win reason
                </Button>
              </div>

              {/* Loss reasons */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Loss reasons
                </span>
                {draft.lossReasonOptions.length === 0 && (
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    No loss reasons — any non-empty reason is accepted.
                  </span>
                )}
                {draft.lossReasonOptions.map((opt, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                  >
                    <Field label="Label" className="min-w-[160px] flex-1">
                      <Input
                        value={opt.label}
                        onChange={(e) =>
                          patchLossOption(i, { label: e.target.value })
                        }
                        placeholder="e.g. Too expensive"
                      />
                    </Field>
                    <Field label="Color" className="min-w-[120px] flex-1">
                      <Input
                        value={opt.color ?? ''}
                        onChange={(e) =>
                          patchLossOption(i, { color: e.target.value })
                        }
                        placeholder="danger / #ef4444"
                      />
                    </Field>
                    <IconButton
                      icon={X}
                      label="Remove loss reason"
                      variant="ghost"
                      onClick={() =>
                        patchDraft({
                          lossReasonOptions: draft.lossReasonOptions.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() =>
                    patchDraft({
                      lossReasonOptions: [
                        ...draft.lossReasonOptions,
                        { value: '', label: '', color: '' },
                      ],
                    })
                  }
                >
                  Add loss reason
                </Button>
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
                  Save & enable
                </Button>
                {selectedSlug !== null && (
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
            <AlertDialogTitle>Delete this win/loss config?</AlertDialogTitle>
            <AlertDialogDescription>
              Outcome values already stamped on records are left as-is. The
              provisioned fields are not removed. This cannot be undone.
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
