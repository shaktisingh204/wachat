'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LuArrowLeft,
  LuSave,
  LuCheck,
  LuLoader,
  LuCircleDot,
  LuCircleOff,
  LuUndo2,
  LuRedo2,
  LuShieldCheck,
  LuChartBar as LuBarChart2,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { SabFlowDoc } from '@/lib/sabflow/types';

/* ── Props ──────────────────────────────────────────────────────────────── */

export type FlowEditorHeaderProps = {
  /** Current flow state (for name + status display). */
  flow: SabFlowDoc & { _id: string };
  /** Undo/redo capability flags. */
  canUndo: boolean;
  canRedo: boolean;
  /** Whether a save is in-flight. */
  isSaving: boolean;
  /** Error message from the last save attempt (null = none). */
  saveError: string | null;
  /** Timestamp of the last successful save (null = never saved this session). */
  lastSaved: Date | null;
  /** Callbacks. */
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPublishToggle: () => void;
  onNameChange: (name: string) => void;
  /** Validation state — drives the shield badge in the header. */
  validationErrorCount?: number;
  validationWarningCount?: number;
  isValidationPanelOpen?: boolean;
  onValidationToggle?: () => void;
  /** Extra toolbar buttons rendered after the divider (panel toggles). */
  children?: React.ReactNode;
};

/* ── EditableFlowName ────────────────────────────────────────────────────── */

type EditableFlowNameProps = {
  name: string;
  onChange: (name: string) => void;
  onCommit: () => void;
};

function EditableFlowName({ name, onChange, onCommit }: EditableFlowNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when name changes externally (e.g. undo restores a name)
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const enter = useCallback(() => {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      setDraft(name); // revert
      return;
    }
    if (trimmed !== name) onChange(trimmed);
    onCommit();
  }, [draft, name, onChange, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        setDraft(name);
        setEditing(false);
      }
    },
    [commit, name],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="text-[14px] font-semibold text-[var(--gray-12)] bg-[var(--gray-3)] border border-[var(--gray-6)] rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-amber-400/60 min-w-0 w-[200px] truncate"
        aria-label="Flow name"
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={enter}
      title="Double-click to rename"
      className="text-[14px] font-semibold text-[var(--gray-12)] bg-transparent border-none outline-none min-w-0 max-w-[200px] truncate hover:bg-[var(--gray-3)] rounded px-1.5 py-0.5 transition-colors cursor-default select-none"
    >
      {draft}
    </button>
  );
}

/* ── FlowEditorHeader ────────────────────────────────────────────────────── */

export function FlowEditorHeader({
  flow,
  canUndo,
  canRedo,
  isSaving,
  saveError,
  lastSaved,
  onUndo,
  onRedo,
  onSave,
  onPublishToggle,
  onNameChange,
  validationErrorCount,
  validationWarningCount,
  isValidationPanelOpen,
  onValidationToggle,
  children,
}: FlowEditorHeaderProps) {
  const isPublished = flow.status === 'PUBLISHED';

  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-center gap-2 border-b border-[var(--gray-5)] bg-[var(--gray-1)] px-3 z-30',
      )}
    >
      {/* ── Left: back button ──────────────────────────────────────────── */}
      <Link
        href="/dashboard/sabflow"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors shrink-0"
        title="Back to flows"
        aria-label="Back to flows"
      >
        <LuArrowLeft className="h-4 w-4" strokeWidth={2} />
      </Link>

      <div className="h-5 w-px bg-[var(--gray-5)] shrink-0" />

      {/* ── Results link ──────────────────────────────────────────────── */}
      <Link
        href={`/dashboard/sabflow/flow-builder/${flow._id}/results`}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors shrink-0"
        title="View results & analytics"
      >
        <LuBarChart2 className="h-3.5 w-3.5" strokeWidth={1.8} />
        <span className="hidden sm:inline">Results</span>
      </Link>

      <div className="h-5 w-px bg-[var(--gray-5)] shrink-0" />

      {/* ── Centre: editable flow name ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <EditableFlowName
          name={flow.name}
          onChange={onNameChange}
          onCommit={onSave}
        />
      </div>

      {/* ── Right cluster ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 shrink-0">

        {/* Undo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          aria-label="Undo"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            canUndo
              ? 'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]'
              : 'text-[var(--gray-6)] cursor-not-allowed',
          )}
        >
          <LuUndo2 className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {/* Redo */}
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            canRedo
              ? 'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]'
              : 'text-[var(--gray-6)] cursor-not-allowed',
          )}
        >
          <LuRedo2 className="h-4 w-4" strokeWidth={1.8} />
        </button>

        <div className="h-5 w-px bg-[var(--gray-5)]" />

        {/* Save status indicator */}
        {saveError ? (
          <span className="text-[11px] text-red-500 max-w-[140px] truncate" title={saveError}>
            {saveError}
          </span>
        ) : lastSaved ? (
          <span className="text-[11px] text-[var(--gray-9)] flex items-center gap-1">
            <LuCheck className="h-3 w-3 text-green-500 shrink-0" strokeWidth={2.5} />
            Saved
          </span>
        ) : null}

        {/* Save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          title="Save (Cmd+S)"
          aria-label="Save"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            isSaving
              ? 'bg-[var(--gray-4)] text-[var(--gray-9)] cursor-wait'
              : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700',
          )}
        >
          {isSaving ? (
            <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <LuSave className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        {/* Publish / Unpublish toggle */}
        <button
          type="button"
          onClick={onPublishToggle}
          disabled={isSaving}
          title={isPublished ? 'Click to unpublish' : 'Click to publish'}
          aria-label={isPublished ? 'Unpublish flow' : 'Publish flow'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            isPublished
              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60'
              : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
          )}
        >
          {isPublished ? (
            <>
              <LuCircleDot className="h-3.5 w-3.5" strokeWidth={2} />
              Published
            </>
          ) : (
            <>
              <LuCircleOff className="h-3.5 w-3.5" strokeWidth={2} />
              Publish
            </>
          )}
        </button>

        {/* Validation toggle */}
        {onValidationToggle && (
          <>
            <div className="h-5 w-px bg-[var(--gray-5)]" />
            <div className="relative">
              <button
                type="button"
                onClick={onValidationToggle}
                title="Validate flow"
                aria-label="Toggle validation panel"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  isValidationPanelOpen
                    ? 'bg-[var(--gray-4)] text-[var(--gray-12)]'
                    : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
                )}
              >
                <LuShieldCheck className="h-4 w-4" strokeWidth={1.8} />
              </button>
              {/* Badge: red if errors, yellow if only warnings */}
              {(validationErrorCount !== undefined && validationErrorCount > 0) && (
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white tabular-nums">
                  {validationErrorCount > 99 ? '99+' : validationErrorCount}
                </span>
              )}
              {(validationErrorCount === 0 && validationWarningCount !== undefined && validationWarningCount > 0) && (
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-0.5 text-[9px] font-bold text-white tabular-nums">
                  {validationWarningCount > 99 ? '99+' : validationWarningCount}
                </span>
              )}
            </div>
          </>
        )}

        {/* Optional extra toolbar buttons (panel toggles, etc.) */}
        {children && (
          <>
            <div className="h-5 w-px bg-[var(--gray-5)]" />
            {children}
          </>
        )}
      </div>
    </header>
  );
}
