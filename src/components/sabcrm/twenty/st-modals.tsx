'use client';

/**
 * SabCRM — reusable Twenty-styled confirm / prompt modals.
 *
 * Drop-in, accessible replacements for `window.confirm` / `window.prompt` that
 * render inside the `.sabcrm-twenty` design system (`.st-dialog*` classes) and
 * return a Promise, so call sites read almost identically to the native APIs:
 *
 * ```tsx
 * const { confirm, dialog } = useStConfirm();
 * // ...
 * if (await confirm({ title: 'Delete view?', message: '…', destructive: true })) {
 *   // proceed
 * }
 * // render `{dialog}` once anywhere in the component's tree
 * return <>{dialog}{rest}</>;
 * ```
 *
 * ```tsx
 * const { prompt, dialog } = useStPrompt();
 * const name = await prompt({ title: 'Name this view', label: 'View name' });
 * if (name) { … }
 * ```
 *
 * Both hooks queue a single active modal at a time, trap focus via the overlay,
 * close on Escape / overlay click (resolving to `false` / `null`), and never
 * throw. They are intentionally controlled-by-promise so they can replace the
 * blocking native calls without restructuring the caller.
 */

import * as React from 'react';
import { X, AlertTriangle } from 'lucide-react';

import { TwentyButton } from './twenty-primitives';

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

export interface StConfirmOptions {
  title: string;
  /** Body text (or node) explaining the consequence. */
  message?: React.ReactNode;
  /** Primary button label. Default: "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
  /** Style the primary action as destructive (red). Default: false. */
  destructive?: boolean;
}

interface ConfirmState extends StConfirmOptions {
  resolve: (ok: boolean) => void;
}

export interface UseStConfirmResult {
  /** Open a confirm modal; resolves true on confirm, false on cancel/dismiss. */
  confirm: (opts: StConfirmOptions) => Promise<boolean>;
  /** Render this once in the component tree. */
  dialog: React.ReactNode;
}

export function useStConfirm(): UseStConfirmResult {
  const [state, setState] = React.useState<ConfirmState | null>(null);

  const confirm = React.useCallback(
    (opts: StConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      }),
    [],
  );

  const settle = React.useCallback(
    (ok: boolean) => {
      setState((cur) => {
        cur?.resolve(ok);
        return null;
      });
    },
    [],
  );

  const dialog = state ? (
    <StModalShell
      title={state.title}
      onDismiss={() => settle(false)}
      footer={
        <>
          <TwentyButton variant="secondary" onClick={() => settle(false)}>
            {state.cancelLabel ?? 'Cancel'}
          </TwentyButton>
          <button
            type="button"
            className={`st-btn ${
              state.destructive ? 'st-btn--danger' : 'st-btn--primary'
            }`}
            onClick={() => settle(true)}
            autoFocus
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      {state.destructive ? (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={15} />
          <span>{state.message ?? 'This action cannot be undone.'}</span>
        </div>
      ) : (
        <p className="st-dialog__text">{state.message}</p>
      )}
    </StModalShell>
  ) : null;

  return { confirm, dialog };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export interface StPromptOptions {
  title: string;
  /** Field label above the input. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Require a non-empty (trimmed) value before the primary action enables. */
  required?: boolean;
}

interface PromptState extends StPromptOptions {
  resolve: (value: string | null) => void;
}

export interface UseStPromptResult {
  /** Open a prompt; resolves the trimmed string, or null on cancel/dismiss. */
  prompt: (opts: StPromptOptions) => Promise<string | null>;
  dialog: React.ReactNode;
}

export function useStPrompt(): UseStPromptResult {
  const [state, setState] = React.useState<PromptState | null>(null);
  const [value, setValue] = React.useState('');

  const prompt = React.useCallback(
    (opts: StPromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? '');
        setState({ ...opts, resolve });
      }),
    [],
  );

  const settle = React.useCallback((result: string | null) => {
    setState((cur) => {
      cur?.resolve(result);
      return null;
    });
  }, []);

  const trimmed = value.trim();
  const canSubmit = state?.required ? trimmed.length > 0 : true;

  const submit = React.useCallback(() => {
    if (state?.required && trimmed.length === 0) return;
    settle(trimmed.length > 0 ? trimmed : value);
  }, [state, trimmed, value, settle]);

  const dialog = state ? (
    <StModalShell
      title={state.title}
      onDismiss={() => settle(null)}
      footer={
        <>
          <TwentyButton variant="secondary" onClick={() => settle(null)}>
            {state.cancelLabel ?? 'Cancel'}
          </TwentyButton>
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            {state.confirmLabel ?? 'Save'}
          </button>
        </>
      }
    >
      <div className="st-field">
        {state.label ? (
          <span className="st-field__label">{state.label}</span>
        ) : null}
        <input
          className="st-input"
          autoFocus
          value={value}
          placeholder={state.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
    </StModalShell>
  ) : null;

  return { prompt, dialog };
}

// ---------------------------------------------------------------------------
// Shared shell
// ---------------------------------------------------------------------------

function StModalShell({
  title,
  children,
  footer,
  onDismiss,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onDismiss: () => void;
}): React.JSX.Element {
  // Escape-to-dismiss.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    // Self-scope under `.sabcrm-twenty` so the `--st-*` tokens resolve even when
    // the host component isn't already inside the SabCRM design-system scope.
    <div
      className="sabcrm-twenty st-dialog-overlay"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        className="st-dialog st-dialog--sm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">{title}</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onDismiss}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">{children}</div>
        <div className="st-dialog__footer">{footer}</div>
      </div>
    </div>
  );
}
