'use client';

/**
 * 20ui — Field, Input, Textarea.
 *
 * The form pattern (taste + a11y): label ALWAYS above the control, helper text
 * and error BELOW it, never placeholder-as-label. `Field` generates the ids and
 * wires `htmlFor` / `aria-describedby` / `aria-invalid` automatically via context,
 * so a control dropped inside a `Field` is correctly labelled + described with
 * zero prop threading.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import './field.css';

interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Read the surrounding `Field`'s a11y wiring (id / described-by / invalid). */
export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export interface FieldProps {
  label?: React.ReactNode;
  /** Helper text under the control. */
  help?: React.ReactNode;
  /** Error message — sets the control invalid + announces via aria-describedby. */
  error?: React.ReactNode;
  required?: boolean;
  /** Pass an explicit id to override the generated one. */
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  help,
  error,
  required = false,
  id,
  className,
  children,
}: FieldProps): React.JSX.Element {
  const auto = React.useId();
  const controlId = id ?? `f-${auto}`;
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  const ctx: FieldContextValue = {
    controlId,
    describedBy,
    invalid: Boolean(error),
    required,
  };

  return (
    <FieldContext.Provider value={ctx}>
      <div className={['u-field', className].filter(Boolean).join(' ')}>
        {label ? (
          <label className="u-field__label" htmlFor={controlId}>
            {label}
            {required ? <span className="u-field__req" aria-hidden="true"> *</span> : null}
          </label>
        ) : null}
        {children}
        {error ? (
          <p className="u-field__error" id={errorId} role="alert">
            {error}
          </p>
        ) : help ? (
          <p className="u-field__help" id={helpId}>
            {help}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  inputSize?: InputSize;
  invalid?: boolean;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  /** Static text affixes (e.g. "https://", "%"). */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /**
   * Free-form leading/trailing content (already-rendered nodes, e.g.
   * `<Search />` or `<Kbd>⌘K</Kbd>`). Distinct from `iconLeft`/`iconRight`,
   * which take a Lucide component. Consumed here so they never leak onto the
   * <input> DOM node.
   */
  leadingSlot?: React.ReactNode;
  trailingSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = 'md', invalid, iconLeft: IconLeft, iconRight: IconRight, prefix, suffix, leadingSlot, trailingSlot, className, id, ...rest },
  ref,
) {
  const field = React.useContext(FieldContext);
  const resolvedId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid ?? false;
  const hasAffix = Boolean(IconLeft || IconRight || prefix || suffix || leadingSlot || trailingSlot);
  const iconSize = inputSize === 'sm' ? 13 : inputSize === 'lg' ? 16 : 14;

  const input = (
    <input
      ref={ref}
      id={resolvedId}
      className={
        hasAffix
          ? 'u-input__control'
          : ['u-input', `u-input--${inputSize}`, isInvalid && 'is-invalid', className].filter(Boolean).join(' ')
      }
      aria-invalid={isInvalid || undefined}
      aria-describedby={field?.describedBy}
      required={field?.required}
      {...rest}
    />
  );

  if (!hasAffix) return input;

  return (
    <div
      className={['u-input', 'u-input--affix', `u-input--${inputSize}`, isInvalid && 'is-invalid', className]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix ? <span className="u-input__affix">{prefix}</span> : null}
      {IconLeft ? <IconLeft size={iconSize} className="u-input__icon" aria-hidden="true" /> : null}
      {leadingSlot ? <span className="u-input__icon" aria-hidden="true">{leadingSlot}</span> : null}
      {input}
      {trailingSlot ? <span className="u-input__icon" aria-hidden="true">{trailingSlot}</span> : null}
      {IconRight ? <IconRight size={iconSize} className="u-input__icon" aria-hidden="true" /> : null}
      {suffix ? <span className="u-input__affix">{suffix}</span> : null}
    </div>
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid, className, id, rows = 3, ...rest }, ref) {
    const field = React.useContext(FieldContext);
    const isInvalid = invalid ?? field?.invalid ?? false;
    return (
      <textarea
        ref={ref}
        id={id ?? field?.controlId}
        rows={rows}
        className={['u-textarea', isInvalid && 'is-invalid', className].filter(Boolean).join(' ')}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field?.describedBy}
        required={field?.required}
        {...rest}
      />
    );
  },
);

export default Field;
