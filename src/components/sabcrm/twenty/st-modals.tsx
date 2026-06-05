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

import { Button } from '@/components/sabcrm/20ui/button';
import { Field, Input } from '@/components/sabcrm/20ui/field';
import { Alert } from '@/components/sabcrm/20ui/feedback';
import { Modal } from '@/components/sabcrm/20ui/modal';

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
          <Button variant="secondary" onClick={() => settle(false)}>
            {state.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={state.destructive ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            autoFocus
          >
            {state.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      {state.destructive ? (
        <Alert tone="danger">
          {state.message ?? 'This action cannot be undone.'}
        </Alert>
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
          <Button variant="secondary" onClick={() => settle(null)}>
            {state.cancelLabel ?? 'Cancel'}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>
            {state.confirmLabel ?? 'Save'}
          </Button>
        </>
      }
    >
      <Field label={state.label}>
        <Input
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
      </Field>
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
  // The 20ui Modal owns the full dialog contract — portal root scoped with the
  // `ui20 sabcrm-twenty` token classes, focus trap + restore, Escape-to-close,
  // overlay-click dismiss, and body-scroll lock — so the shell is a thin adapter
  // that maps the promise-driven options onto the controlled `open`/`onClose` API.
  return (
    <Modal open onClose={onDismiss} title={title} footer={footer} size="sm">
      {children}
    </Modal>
  );
}
