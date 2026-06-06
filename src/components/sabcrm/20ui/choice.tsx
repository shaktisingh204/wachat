'use client';

/**
 * 20ui — Switch, Checkbox, Radio, RadioGroup.
 *
 * The choice family. Twenty stays near-monochrome: an unchecked control is a
 * quiet outlined box, the accent (Twenty blue) only appears once a choice is
 * made — colour carries the "on" meaning and nothing else.
 *
 * - `Switch` is a `button[role="switch"]` with `aria-checked`; the knob slides
 *   on a transform, so it animates cheaply and respects reduced motion.
 * - `Checkbox` / `Radio` keep a real native `<input>` for keyboard + a11y and
 *   visually replace it with a sibling box/dot driven by `:checked`.
 * - `RadioGroup` is a `role="radiogroup"` wrapper that lays its radios out
 *   vertically or horizontally and labels the set.
 *
 * Every control reads the form `FieldContext` (see ./field) so dropping one
 * inside a `<Field>` inherits the generated id / described-by / invalid state.
 */

import * as React from 'react';
import { Check, Minus } from 'lucide-react';

import { useFieldContext } from './field';
import './choice.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type ChoiceSize = 'sm' | 'md';

/* ------------------------------------------------------------------ Switch */

export interface SwitchProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onChange' | 'type' | 'value'
  > {
  /** Controlled on/off state. */
  checked?: boolean;
  /** Uncontrolled initial state. */
  defaultChecked?: boolean;
  /** Fires with the next boolean value on toggle. */
  onCheckedChange?: (checked: boolean) => void;
  size?: ChoiceSize;
  /** Optional inline label rendered after the track. */
  label?: React.ReactNode;
  /** Accessible name when there is no visible `label`. */
  'aria-label'?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      checked,
      defaultChecked = false,
      onCheckedChange,
      size = 'md',
      label,
      className,
      disabled,
      onClick,
      id,
      ...rest
    },
    ref,
  ) {
    const field = useFieldContext();
    const isControlled = checked !== undefined;
    const [internal, setInternal] = React.useState(defaultChecked);
    const on = isControlled ? checked! : internal;

    const controlId = id ?? field?.controlId;

    const toggle = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        const next = !on;
        if (!isControlled) setInternal(next);
        onCheckedChange?.(next);
      },
      [disabled, isControlled, on, onClick, onCheckedChange],
    );

    const control = (
      <button
        ref={ref}
        type="button"
        role="switch"
        id={controlId}
        aria-checked={on}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        disabled={disabled}
        onClick={toggle}
        className={cx(
          'u-switch',
          `u-switch--${size}`,
          on && 'is-on',
          !label && className,
        )}
        {...rest}
      >
        <span className="u-switch__knob" aria-hidden="true" />
      </button>
    );

    if (!label) return control;

    return (
      <span className={cx('u-choice-inline', disabled && 'is-disabled', className)}>
        {control}
        <span className="u-choice-inline__label">{label}</span>
      </span>
    );
  },
);

/* ---------------------------------------------------------------- Checkbox */

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: ChoiceSize;
  /** Tri-state visual (drawn as a dash); native `checked` still drives value. */
  indeterminate?: boolean;
  /** Optional inline label rendered after the box. */
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { size = 'md', indeterminate = false, label, className, disabled, id, ...rest },
    ref,
  ) {
    const field = useFieldContext();
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const iconSize = size === 'sm' ? 11 : 13;

    const control = (
      <span className={cx('u-check', `u-check--${size}`, !label && className)}>
        <input
          ref={innerRef}
          type="checkbox"
          id={id ?? field?.controlId}
          className="u-check__input"
          disabled={disabled}
          aria-invalid={field?.invalid || undefined}
          aria-describedby={field?.describedBy}
          required={field?.required}
          {...rest}
        />
        <span className="u-check__box" aria-hidden="true">
          {indeterminate ? (
            <Minus size={iconSize} strokeWidth={3} className="u-check__mark" />
          ) : (
            <Check size={iconSize} strokeWidth={3} className="u-check__mark" />
          )}
        </span>
      </span>
    );

    if (!label) return control;

    return (
      <label className={cx('u-choice-inline', disabled && 'is-disabled', className)}>
        {control}
        <span className="u-choice-inline__label">{label}</span>
      </label>
    );
  },
);

/* ------------------------------------------------------------------- Radio */

interface RadioContextValue {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  size: ChoiceSize;
  disabled?: boolean;
}

const RadioContext = React.createContext<RadioContextValue | null>(null);

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** This option's value — compared against the group value when grouped. */
  value: string;
  size?: ChoiceSize;
  /** Optional inline label rendered after the dot. */
  label?: React.ReactNode;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  function Radio(
    { value, size, label, className, disabled, name, checked, onChange, ...rest },
    ref,
  ) {
    const group = React.useContext(RadioContext);
    const field = useFieldContext();

    const resolvedSize = size ?? group?.size ?? 'md';
    const resolvedName = name ?? group?.name;
    const resolvedDisabled = disabled ?? group?.disabled;
    const resolvedChecked =
      group?.value !== undefined ? group.value === value : checked;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      if (event.target.checked) group?.onChange?.(value);
    };

    const control = (
      <span className={cx('u-radio', `u-radio--${resolvedSize}`, !label && className)}>
        <input
          ref={ref}
          type="radio"
          className="u-radio__input"
          name={resolvedName}
          value={value}
          checked={resolvedChecked}
          disabled={resolvedDisabled}
          onChange={handleChange}
          aria-invalid={field?.invalid || undefined}
          aria-describedby={field?.describedBy}
          {...rest}
        />
        <span className="u-radio__dot" aria-hidden="true" />
      </span>
    );

    if (!label) return control;

    return (
      <label className={cx('u-choice-inline', resolvedDisabled && 'is-disabled', className)}>
        {control}
        <span className="u-choice-inline__label">{label}</span>
      </label>
    );
  },
);

/* -------------------------------------------------------------- RadioGroup */

export interface RadioGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Shared `name` for the native radios. */
  name?: string;
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: ChoiceSize;
  /** Stack the radios (default) or lay them in a row. */
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  /** Accessible name for the set (falls back to the Field label via id). */
  'aria-label'?: string;
}

export function RadioGroup({
  name,
  value,
  defaultValue,
  onValueChange,
  size = 'md',
  orientation = 'vertical',
  disabled,
  className,
  children,
  ...rest
}: RadioGroupProps): React.JSX.Element {
  const field = useFieldContext();
  const auto = React.useId();
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const selected = isControlled ? value : internal;

  const handleChange = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const ctx: RadioContextValue = {
    name: name ?? `r-${auto}`,
    value: selected,
    onChange: handleChange,
    size,
    disabled,
  };

  return (
    <RadioContext.Provider value={ctx}>
      <div
        role="radiogroup"
        id={field?.controlId}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        className={cx('u-radio-group', `u-radio-group--${orientation}`, className)}
        {...rest}
      >
        {children}
      </div>
    </RadioContext.Provider>
  );
}

/**
 * Alias: the radio option inside a `RadioGroup`. Same component as `Radio`
 * (`<RadioGroupItem value="x" id="..." />`) — provided so legacy/shadcn-shaped
 * call sites work with the 20ui RadioGroup context.
 */
export const RadioGroupItem = Radio;

export default Switch;
