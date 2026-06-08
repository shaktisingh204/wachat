'use client';

/**
 * SabCRM - Functions settings (`/dashboard/settings/crm/functions`).
 *
 * A manager for logic / serverless function DEFINITIONS. This page is
 * intentionally *definition only*: it lets you author, name, pick a target
 * runtime for, and describe the trigger of a function, but it does NOT run
 * anything. Execution requires the SabCRM function engine, which is not wired
 * up yet. Every surface on this page is honest about that.
 *
 * Persistence is local (plus a fire-and-forget server sync) via the
 * `useFunctions` hook. No server-only imports - this is a pure client page.
 *
 * Layout is a two-pane split:
 *   - Left  - list of saved functions (name + runtime badge) and an
 *             "Add function" button.
 *   - Right - an editor for the selected function: name input, runtime select
 *             (Node.js / Deno), a monospace code textarea, a trigger note, and
 *             Save / Delete actions, plus the engine-not-wired honesty note.
 *
 * States: hydration skeleton, empty list, no-selection placeholder, and a
 * delete confirmation dialog.
 *
 * Pure 20ui: every control comes from `@/components/sabcrm/20ui`.
 */

import * as React from 'react';
import {
  FunctionSquare,
  Plus,
  Save,
  Trash2,
  Check,
  Code2,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Textarea,
  Callout,
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
} from '@/components/sabcrm/20ui';

import {
  useFunctions,
  RUNTIME_LABELS,
  type CrmFunction,
  type FunctionRuntime,
  type CrmFunctionDraft,
} from './use-functions';

import '@/components/sabcrm/20ui/surface-crm-base.css';

const RUNTIMES: FunctionRuntime[] = ['node', 'deno'];

const RUNTIME_TONE: Record<FunctionRuntime, 'success' | 'info'> = {
  node: 'success',
  deno: 'info',
};

// ---------------------------------------------------------------------------
// Runtime badge
// ---------------------------------------------------------------------------

function RuntimeBadge({ runtime }: { runtime: FunctionRuntime }): React.JSX.Element {
  return (
    <Badge tone={RUNTIME_TONE[runtime]} dot>
      {RUNTIME_LABELS[runtime]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Left pane - function list
// ---------------------------------------------------------------------------

interface FunctionListProps {
  functions: CrmFunction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

function FunctionList({
  functions,
  selectedId,
  onSelect,
  onAdd,
}: FunctionListProps): React.JSX.Element {
  return (
    <Card
      variant="outlined"
      padding="none"
      className="flex flex-col overflow-hidden"
    >
      <CardHeader className="flex items-center justify-between gap-[var(--st-space-2)]">
        <span className="text-[13px] font-semibold text-[var(--st-text)]">
          Functions
        </span>
        <Button variant="secondary" size="sm" iconLeft={Plus} onClick={onAdd}>
          Add
        </Button>
      </CardHeader>
      {functions.length === 0 ? (
        <p className="m-0 p-[var(--st-space-3)] text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
          No functions yet. Use <strong className="text-[var(--st-text)]">Add</strong>{' '}
          to create your first definition.
        </p>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-1)] p-[var(--st-space-2)]">
          {functions.map((fn) => {
            const active = fn.id === selectedId;
            return (
              <Button
                key={fn.id}
                variant="ghost"
                block
                onClick={() => onSelect(fn.id)}
                aria-pressed={active}
                className={[
                  'h-auto justify-start px-[var(--st-space-2)] py-[var(--st-space-2)] text-left',
                  active
                    ? 'bg-[var(--st-accent-soft)] text-[var(--st-text)]'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="flex w-full flex-col items-start gap-[var(--st-space-1)]">
                  <span className="w-full truncate font-mono text-[13px] font-medium text-[var(--st-text)]">
                    {fn.name || 'untitled'}
                  </span>
                  <RuntimeBadge runtime={fn.runtime} />
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Right pane - editor
// ---------------------------------------------------------------------------

interface FunctionEditorProps {
  /** The function being edited; re-keyed by the parent so drafts reset on change. */
  fn: CrmFunction;
  onSave: (id: string, draft: CrmFunctionDraft) => void;
  onRequestDelete: (fn: CrmFunction) => void;
}

function FunctionEditor({
  fn,
  onSave,
  onRequestDelete,
}: FunctionEditorProps): React.JSX.Element {
  const [name, setName] = React.useState(fn.name);
  const [runtime, setRuntime] = React.useState<FunctionRuntime>(fn.runtime);
  const [code, setCode] = React.useState(fn.code);
  const [trigger, setTrigger] = React.useState(fn.trigger);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState(false);

  const dirty =
    name !== fn.name ||
    runtime !== fn.runtime ||
    code !== fn.code ||
    trigger !== fn.trigger;

  const handleSave = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError('A function name is required.');
        return;
      }
      setError(null);
      onSave(fn.id, { name: trimmed, runtime, code, trigger: trigger.trim() });
      setSavedAt(true);
      window.setTimeout(() => setSavedAt(false), 1800);
    },
    [name, runtime, code, trigger, fn.id, onSave],
  );

  return (
    <form onSubmit={handleSave}>
      <Card
        variant="outlined"
        padding="none"
        className="flex flex-col overflow-hidden"
      >
      <CardHeader className="flex flex-wrap items-center justify-between gap-[var(--st-space-2)]">
        <div className="flex items-center gap-[var(--st-space-2)]">
          <Code2
            size={15}
            aria-hidden="true"
            className="text-[var(--st-text-tertiary)]"
          />
          <span className="font-mono text-[13px] font-medium text-[var(--st-text)]">
            {fn.name || 'untitled'}
          </span>
          <RuntimeBadge runtime={fn.runtime} />
        </div>
        <div className="flex items-center gap-[var(--st-space-2)]">
          {savedAt ? (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--st-status-ok)]"
              role="status"
            >
              <Check size={13} aria-hidden="true" />
              Saved
            </span>
          ) : null}
          <Button type="submit" variant="primary" iconLeft={Save} disabled={!dirty}>
            Save
          </Button>
          <Button
            variant="danger"
            iconLeft={Trash2}
            onClick={() => onRequestDelete(fn)}
            title="Delete function"
          >
            Delete
          </Button>
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-[var(--st-space-4)]">
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
          <Field
            label="Name"
            required
            help="Used to identify the function. Keep it short and slug-like."
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="enrich-lead"
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
          </Field>

          <Field label="Runtime" help="Target for the eventual engine.">
            <Select
              value={runtime}
              onValueChange={(value) => setRuntime(value as FunctionRuntime)}
            >
              <SelectTrigger aria-label="Runtime">
                <SelectValue placeholder="Pick a runtime" />
              </SelectTrigger>
              <SelectContent>
                {RUNTIMES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {RUNTIME_LABELS[rt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Code"
          help="Stored verbatim as a definition. It is never executed from this page."
        >
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// Define your function here."
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            wrap="off"
            rows={12}
            className="font-mono text-[12.5px] leading-relaxed whitespace-pre"
          />
        </Field>

        <Field
          label="Trigger note"
          help="A free-text reminder of when this function is meant to run. Triggers aren't wired up yet, so this is documentation only."
        >
          <Textarea
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="e.g. Run when a Person record is created, or on a daily schedule."
            rows={3}
          />
        </Field>

        <Callout tone="info" title="Definition only.">
          This saves the definition only. Actually running it needs the SabCRM
          function engine, which isn't connected yet, so there is no execute path
          here. Your work is kept locally in this browser until the engine lands.
        </Callout>

        {error ? (
          <p className="m-0 text-[13px] font-medium text-[var(--st-danger)]">
            {error}
          </p>
        ) : null}
      </CardBody>
      </Card>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  fn: CrmFunction;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({ fn, onCancel, onConfirm }: DeleteDialogProps): React.JSX.Element {
  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete function</AlertDialogTitle>
          <AlertDialogDescription>
            Delete{' '}
            <strong className="text-[var(--st-text)]">
              {fn.name || 'this function'}
            </strong>
            ? The definition is removed from this browser. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete function</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function FunctionsSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card variant="outlined" padding="sm" className="flex flex-col gap-[var(--st-space-2)]">
        <Skeleton height={16} radius={6} />
        <Skeleton height={16} radius={6} />
        <Skeleton height={16} radius={6} />
      </Card>
      <Card variant="outlined" padding="md" className="flex flex-col gap-[var(--st-space-3)]">
        <Skeleton height={16} radius={6} />
        <Skeleton height={16} radius={6} />
        <Skeleton height={120} radius={6} />
        <Skeleton height={16} radius={6} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmFunctionsSettingsPage(): React.JSX.Element {
  const { functions, ready, create, update, remove } = useFunctions();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmFunction | null>(null);

  // Keep a valid selection: default to the first function, and recover if the
  // selected one disappears (e.g. after a delete).
  React.useEffect(() => {
    if (!ready) return;
    if (functions.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && functions.some((f) => f.id === prev) ? prev : functions[0].id,
    );
  }, [ready, functions]);

  const selected = React.useMemo(
    () => functions.find((f) => f.id === selectedId) ?? null,
    [functions, selectedId],
  );

  const handleAdd = React.useCallback(() => {
    const fn = create();
    setSelectedId(fn.id);
  }, [create]);

  const confirmDelete = React.useCallback(() => {
    if (!deleteTarget) return;
    remove(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  return (
    <div className="20ui mx-auto flex w-full max-w-[1080px] flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Functions</PageTitle>
          <PageDescription>
            Author and keep logic / serverless function definitions for this
            workspace - a name, a target runtime, the code, and a note on when it
            should run. These are definitions only: SabCRM doesn't execute them
            yet, so nothing here runs against your data. They're saved locally in
            this browser until the function engine is wired up.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={handleAdd}>
            Add function
          </Button>
        </PageActions>
      </PageHeader>

      {!ready ? (
        <FunctionsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_minmax(0,1fr)]">
          <FunctionList
            functions={functions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={handleAdd}
          />

          {selected ? (
            <FunctionEditor
              // Re-key on the selected id so the editor's local draft state
              // resets cleanly when you switch functions.
              key={selected.id}
              fn={selected}
              onSave={update}
              onRequestDelete={setDeleteTarget}
            />
          ) : (
            <Card
              variant="outlined"
              padding="lg"
              className="flex items-center justify-center"
            >
              <EmptyState
                icon={FunctionSquare}
                title="No function selected"
                description="Add a function to start writing a definition. Running it will require the function engine, which isn't connected yet."
              />
            </Card>
          )}
        </div>
      )}

      {deleteTarget ? (
        <DeleteDialog
          fn={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
