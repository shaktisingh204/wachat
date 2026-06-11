'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Check,
  CircleDot,
  CircleOff,
  Undo2,
  Redo2,
  ShieldCheck,
  BarChart2,
} from 'lucide-react';
import { Button, IconButton, Badge, Input, cn } from '@/components/sabcrm/20ui';
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
  /**
   * Whether there are unsaved changes (drives the dot + Save enablement).
   * Optional: callers that don't track dirtiness (collab path persists via
   * Yjs) omit it and keep the always-enabled Save button.
   */
  isDirty?: boolean;
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
  /** Validation state, drives the shield badge in the header. */
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
      <Input
        ref={inputRef}
        inputSize="sm"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-[200px] min-w-0 truncate text-[14px] font-semibold"
        aria-label="Flow name"
        autoFocus
      />
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onDoubleClick={enter}
      title="Double-click to rename"
      className="min-w-0 max-w-[200px] truncate text-[14px] font-semibold"
    >
      {draft}
    </Button>
  );
}

/* ── FlowEditorHeader ────────────────────────────────────────────────────── */

export function FlowEditorHeader({
  flow,
  canUndo,
  canRedo,
  isSaving,
  isDirty,
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
        'z-30 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-3',
      )}
    >
      {/* ── Left: back button ──────────────────────────────────────────── */}
      <Link
        href="/dashboard/sabflow"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] text-[var(--st-text-tertiary)] transition-colors hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
        title="Back to flows"
        aria-label="Back to flows"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </Link>

      <div className="h-5 w-px shrink-0 bg-[var(--st-border)]" />

      {/* ── Results link ──────────────────────────────────────────────── */}
      <Link
        href={`/dashboard/sabflow/flow-builder/${flow._id}/results`}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--st-radius)] px-2.5 text-[12px] text-[var(--st-text-tertiary)] transition-colors hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
        title="View results and analytics"
      >
        <BarChart2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        <span className="hidden sm:inline">Results</span>
      </Link>

      <div className="h-5 w-px shrink-0 bg-[var(--st-border)]" />

      {/* ── Centre: editable flow name ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <EditableFlowName
          name={flow.name}
          onChange={onNameChange}
          onCommit={onSave}
        />
        {/* Unsaved-changes dot */}
        {isDirty && (
          <span
            className="ml-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--st-accent)]"
            title="Unsaved changes"
            role="status"
            aria-label="Unsaved changes"
          />
        )}
      </div>

      {/* ── Right cluster ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1.5">

        {/* Undo */}
        <IconButton
          label="Undo"
          icon={Undo2}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        />

        {/* Redo */}
        <IconButton
          label="Redo"
          icon={Redo2}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        />

        <div className="h-5 w-px bg-[var(--st-border)]" />

        {/* Save status indicator (covers manual saves and autosave) */}
        {saveError ? (
          <span className="max-w-[140px] truncate text-[11px] text-[var(--st-danger)]" title={saveError}>
            {saveError}
          </span>
        ) : isSaving ? (
          <span className="text-[11px] text-[var(--st-text-tertiary)]" aria-live="polite">
            Saving...
          </span>
        ) : lastSaved ? (
          <span className="flex items-center gap-1 text-[11px] text-[var(--st-text-tertiary)]" aria-live="polite">
            <Check className="h-3 w-3 shrink-0 text-[var(--st-status-ok)]" strokeWidth={2.5} aria-hidden="true" />
            Saved{' '}
            {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}

        {/* Save button (built-in spinner via the loading prop). Disabled when
            there is nothing to save - autosave keeps the doc clean anyway. */}
        <Button
          variant="primary"
          size="sm"
          iconLeft={Save}
          loading={isSaving}
          onClick={() => onSave()}
          disabled={isSaving || isDirty === false}
          title="Save (Cmd+S)"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>

        {/* Publish / Unpublish toggle */}
        <Button
          variant={isPublished ? 'outline' : 'secondary'}
          size="sm"
          iconLeft={isPublished ? CircleDot : CircleOff}
          onClick={onPublishToggle}
          disabled={isSaving}
          title={isPublished ? 'Click to unpublish' : 'Click to publish'}
          aria-label={isPublished ? 'Unpublish flow' : 'Publish flow'}
        >
          {isPublished ? 'Published' : 'Publish'}
        </Button>

        {/* Validation toggle */}
        {onValidationToggle && (
          <>
            <div className="h-5 w-px bg-[var(--st-border)]" />
            <div className="relative">
              <IconButton
                label="Toggle validation panel"
                icon={ShieldCheck}
                onClick={onValidationToggle}
                title="Validate flow"
                aria-pressed={isValidationPanelOpen}
                className={isValidationPanelOpen ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)]' : undefined}
              />
              {/* Badge: danger if errors, warning if only warnings */}
              {(validationErrorCount !== undefined && validationErrorCount > 0) && (
                <Badge
                  tone="danger"
                  kind="solid"
                  className="pointer-events-none absolute -right-1 -top-1 tabular-nums"
                >
                  {validationErrorCount > 99 ? '99+' : validationErrorCount}
                </Badge>
              )}
              {(validationErrorCount === 0 && validationWarningCount !== undefined && validationWarningCount > 0) && (
                <Badge
                  tone="warning"
                  kind="solid"
                  className="pointer-events-none absolute -right-1 -top-1 tabular-nums"
                >
                  {validationWarningCount > 99 ? '99+' : validationWarningCount}
                </Badge>
              )}
            </div>
          </>
        )}

        {/* Optional extra toolbar buttons (panel toggles, etc.) */}
        {children && (
          <>
            <div className="h-5 w-px bg-[var(--st-border)]" />
            {children}
          </>
        )}
      </div>
    </header>
  );
}
