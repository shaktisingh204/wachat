'use client';

/**
 * SabCRM — Functions settings (`/sabcrm/settings/functions`), Twenty-style.
 *
 * A manager for logic / serverless function DEFINITIONS. This page is
 * intentionally *definition only*: it lets you author, name, pick a target
 * runtime for, and describe the trigger of a function — but it does NOT run
 * anything. Execution requires the SabCRM function engine, which is not wired
 * up yet. Every surface on this page is honest about that.
 *
 * Persistence is local: definitions are stored in `localStorage` via the
 * `useFunctions` prefs-style hook. No server actions, no network, no
 * `server-only` imports — this is a pure client page.
 *
 * Layout is a Twenty two-pane:
 *   - Left  — list of saved functions (monospace name + runtime badge) and an
 *             "Add function" button.
 *   - Right — an editor for the selected function: name input, runtime select
 *             (Node.js / Deno), a monospace code textarea, a trigger note, and
 *             Save / Delete actions, plus the engine-not-wired honesty note.
 *
 * States: hydration skeleton, empty list, no-selection placeholder, and a
 * delete confirmation dialog.
 */

import * as React from 'react';
import {
  FunctionSquare,
  Plus,
  Save,
  Trash2,
  Check,
  Info,
  X,
  Code2,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import {
  useFunctions,
  RUNTIME_LABELS,
  type CrmFunction,
  type FunctionRuntime,
  type CrmFunctionDraft,
} from './use-functions';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './functions.css';

const RUNTIMES: FunctionRuntime[] = ['node', 'deno'];

// ---------------------------------------------------------------------------
// Runtime badge
// ---------------------------------------------------------------------------

function RuntimeBadge({ runtime }: { runtime: FunctionRuntime }): React.JSX.Element {
  return (
    <span className={`st-fn-badge st-fn-badge--${runtime}`}>
      <span className="st-fn-badge__dot" aria-hidden="true" />
      {RUNTIME_LABELS[runtime]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Left pane — function list
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
    <aside className="st-fn-list">
      <div className="st-fn-list__head">
        <span className="st-fn-list__title">Functions</span>
        <TwentyButton variant="secondary" icon={Plus} onClick={onAdd}>
          Add
        </TwentyButton>
      </div>
      {functions.length === 0 ? (
        <div className="st-fn-list__empty">
          No functions yet. Use <strong>Add</strong> to create your first
          definition.
        </div>
      ) : (
        <div className="st-fn-list__items">
          {functions.map((fn) => (
            <button
              key={fn.id}
              type="button"
              className={`st-fn-item${fn.id === selectedId ? ' is-active' : ''}`}
              onClick={() => onSelect(fn.id)}
              aria-pressed={fn.id === selectedId}
            >
              <span className="st-fn-item__name">{fn.name || 'untitled'}</span>
              <span className="st-fn-item__meta">
                <RuntimeBadge runtime={fn.runtime} />
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Right pane — editor
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
    <form className="st-fn-editor" onSubmit={handleSave}>
      <div className="st-fn-editor__head">
        <div className="st-fn-editor__head-meta">
          <Code2 size={15} aria-hidden="true" style={{ color: 'var(--st-text-tertiary)' }} />
          <span className="st-fn-editor__head-title">{fn.name || 'untitled'}</span>
          <RuntimeBadge runtime={fn.runtime} />
        </div>
        <div className="st-fn-editor__head-actions">
          {savedAt ? (
            <span className="st-fn-saved">
              <Check size={13} aria-hidden="true" />
              Saved
            </span>
          ) : null}
          <TwentyButton type="submit" variant="primary" icon={Save} disabled={!dirty}>
            Save
          </TwentyButton>
          <TwentyButton
            variant="ghost"
            icon={Trash2}
            className="st-btn--danger"
            onClick={() => onRequestDelete(fn)}
            title="Delete function"
          >
            Delete
          </TwentyButton>
        </div>
      </div>

      <div className="st-fn-editor__body">
        <div className="st-fn-grid">
          <div className="st-field">
            <label className="st-field__label" htmlFor="fn-name">
              Name
              <span className="st-field__req" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="fn-name"
              className="st-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="enrich-lead"
              spellCheck={false}
              autoComplete="off"
            />
            <p className="st-fn-hint">
              Used to identify the function. Keep it short and slug-like.
            </p>
          </div>

          <div className="st-field">
            <label className="st-field__label" htmlFor="fn-runtime">
              Runtime
            </label>
            <select
              id="fn-runtime"
              className="st-select"
              value={runtime}
              onChange={(e) => setRuntime(e.target.value as FunctionRuntime)}
            >
              {RUNTIMES.map((rt) => (
                <option key={rt} value={rt}>
                  {RUNTIME_LABELS[rt]}
                </option>
              ))}
            </select>
            <p className="st-fn-hint">Target for the eventual engine.</p>
          </div>
        </div>

        <div className="st-field">
          <label className="st-field__label" htmlFor="fn-code">
            Code
          </label>
          <textarea
            id="fn-code"
            className="st-fn-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// Define your function here…"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            wrap="off"
          />
          <p className="st-fn-hint">
            Stored verbatim as a definition. It is never executed from this page.
          </p>
        </div>

        <div className="st-field">
          <label className="st-field__label" htmlFor="fn-trigger">
            Trigger note
          </label>
          <textarea
            id="fn-trigger"
            className="st-textarea"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="e.g. Run when a Person record is created, or on a daily schedule."
          />
          <p className="st-fn-hint">
            A free-text reminder of when this function is meant to run. Triggers
            aren&apos;t wired up yet — this is documentation only.
          </p>
        </div>

        <div className="st-fn-engine-note">
          <Info className="st-fn-engine-note__icon" size={14} aria-hidden="true" />
          <span>
            Heads up: this saves the <strong>definition</strong> only. Actually
            running it needs the SabCRM function engine, which isn&apos;t
            connected yet — there is no <code>execute</code> path here. Your work
            is kept locally in this browser until the engine lands.
          </span>
        </div>

        {error ? <p className="st-form-error">{error}</p> : null}
      </div>
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
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete function"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete function</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete{' '}
            <strong style={{ color: 'var(--st-text)' }}>
              {fn.name || 'this function'}
            </strong>
            ? The definition is removed from this browser. This cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel}>
            Cancel
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            className="st-btn--danger"
            onClick={onConfirm}
          >
            Delete function
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function FunctionsSkeleton(): React.JSX.Element {
  return (
    <div className="st-fn-split">
      <div className="st-fn-list" style={{ padding: 'var(--st-space-2)' }}>
        <div className="st-skeleton st-skeleton-row" />
        <div className="st-skeleton st-skeleton-row" />
        <div className="st-skeleton st-skeleton-row" />
      </div>
      <div className="st-fn-editor" style={{ padding: 'var(--st-space-3)' }}>
        <div className="st-skeleton st-skeleton-row" />
        <div className="st-skeleton st-skeleton-row" />
        <div className="st-skeleton st-skeleton-row" />
        <div className="st-skeleton st-skeleton-row" />
      </div>
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
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Functions"
          icon={FunctionSquare}
          actions={
            <TwentyButton variant="primary" icon={Plus} onClick={handleAdd}>
              Add function
            </TwentyButton>
          }
        />
        <p className="st-settings__intro">
          Author and keep logic / serverless function <strong>definitions</strong>{' '}
          for this workspace — a name, a target runtime, the code, and a note on
          when it should run. These are definitions only: SabCRM doesn&apos;t
          execute them yet, so nothing here runs against your data. They&apos;re
          saved locally in this browser until the function engine is wired up.
        </p>

        {!ready ? (
          <FunctionsSkeleton />
        ) : (
          <div className="st-fn-split">
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
              <div className="st-fn-editor st-fn-editor--empty">
                <div className="st-empty">
                  <span className="st-empty__icon">
                    <FunctionSquare size={20} />
                  </span>
                  <h2 className="st-empty__title">No function selected</h2>
                  <p className="st-empty__desc">
                    Add a function to start writing a definition. Running it will
                    require the function engine, which isn&apos;t connected yet.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
