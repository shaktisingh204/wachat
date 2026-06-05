'use client';

/**
 * 20ui — Extras: RadioCard / RadioCardGroup, Rating, OtpInput, SearchInput.
 *
 * Four self-contained interactive primitives that share the 20ui token set, one
 * accent, one focus ring, and the Emil motion language (transform/opacity only,
 * scale-on-press, reduced-motion safe).
 *
 *  - RadioCardGroup + RadioCard: a set of bordered selectable tiles. The group
 *    is `role="radiogroup"` and drives roving focus with arrow keys; each card
 *    is `role="radio"` with `aria-checked`. Selecting lights the accent border,
 *    a soft ring, and a check indicator.
 *  - Rating: a star rating built on lucide Star. Keyboard accessible
 *    (`role="slider"` semantics), controlled or read-only.
 *  - OtpInput: N single-character boxes. Paste fills across boxes, arrows and
 *    Backspace navigate, `inputMode="numeric"`, one aria-label per box.
 *  - SearchInput: an Input with a leading search icon, a clear button, an
 *    optional shortcut hint, and a debounced `onSearch`.
 */

import * as React from 'react';
import { Check, Search, Star, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import './extras.css';

/* ============================================================================
 * RadioCardGroup + RadioCard
 * ========================================================================== */

interface RadioCardGroupContextValue {
  value: string | undefined;
  setValue: (next: string) => void;
  name: string;
  disabled: boolean;
  /** The value that owns the single tab stop when nothing is selected yet. */
  leadValue: string | undefined;
  /** Register a card value in DOM order so arrows can rove between them. */
  register: (value: string) => () => void;
  /** Move selection + focus to the card before/after the given value. */
  move: (from: string, dir: 1 | -1) => void;
}

const RadioCardGroupContext = React.createContext<RadioCardGroupContextValue | null>(null);

export interface RadioCardGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Selected card value (controlled). */
  value?: string;
  /** Initial selected value (uncontrolled). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Shared radio group name. Auto-generated when omitted. */
  name?: string;
  /** Accessible name for the group. */
  label?: string;
  disabled?: boolean;
}

/** A `role="radiogroup"` wrapper coordinating a set of `RadioCard`s. */
export function RadioCardGroup({
  value: valueProp,
  defaultValue,
  onChange,
  name,
  label,
  disabled = false,
  className,
  children,
  ...rest
}: RadioCardGroupProps): React.JSX.Element {
  const autoName = React.useId();
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internal;

  // Ordered list of registered card values — the roving-focus targets. The
  // first registered (top-most) value owns the tab stop until a selection is
  // made; `leadValue` mirrors it into state so cards re-render their tabIndex.
  const orderRef = React.useRef<string[]>([]);
  const [leadValue, setLeadValue] = React.useState<string | undefined>(undefined);
  const register = React.useCallback((v: string) => {
    orderRef.current.push(v);
    setLeadValue(orderRef.current[0]);
    return () => {
      orderRef.current = orderRef.current.filter((x) => x !== v);
      setLeadValue(orderRef.current[0]);
    };
  }, []);

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const move = React.useCallback(
    (from: string, dir: 1 | -1) => {
      const order = orderRef.current;
      if (order.length === 0) return;
      const current = order.indexOf(from);
      const start = current < 0 ? 0 : current;
      const next = order[(start + dir + order.length) % order.length];
      setValue(next);
      // Focus follows selection (standard radio-group behaviour).
      const el = document.querySelector<HTMLElement>(
        `[data-radiocard][data-name="${name ?? autoName}"][data-value="${CSS.escape(next)}"]`,
      );
      el?.focus();
    },
    [setValue, name, autoName],
  );

  const ctx = React.useMemo<RadioCardGroupContextValue>(
    () => ({ value, setValue, name: name ?? autoName, disabled, leadValue, register, move }),
    [value, setValue, name, autoName, disabled, leadValue, register, move],
  );

  return (
    <RadioCardGroupContext.Provider value={ctx}>
      <div
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={['u-radiocards', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
    </RadioCardGroupContext.Provider>
  );
}

export interface RadioCardProps
  extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** The value this card represents within its group. */
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Indicator style: a check badge (default) or a filled dot. */
  indicator?: 'check' | 'dot';
}

/** A bordered, selectable tile. Must live inside a `RadioCardGroup`. */
export const RadioCard = React.forwardRef<HTMLButtonElement, RadioCardProps>(
  function RadioCard(
    { value, label, description, icon: Icon, disabled: cardDisabled, indicator = 'check', className, ...rest },
    ref,
  ) {
    const group = React.useContext(RadioCardGroupContext);
    if (!group) {
      throw new Error('RadioCard must be rendered inside a RadioCardGroup.');
    }
    const { value: selected, setValue, name, disabled: groupDisabled, leadValue, register, move } = group;
    const disabled = cardDisabled || groupDisabled;
    const checked = selected === value;

    React.useEffect(() => register(value), [register, value]);

    // Exactly one card per group is in the page tab order: the selected one, or
    // the lead (first-registered) card when nothing is selected yet. Arrow keys
    // move selection-with-focus from there (standard radio-group behaviour).
    const tabbable = checked || (selected === undefined && leadValue === value);

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) return;
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          move(value, 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          move(value, -1);
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          setValue(value);
          break;
        default:
          break;
      }
    };

    const cls = [
      'u-radiocard',
      checked && 'is-checked',
      disabled && 'is-disabled',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        tabIndex={disabled ? -1 : tabbable ? 0 : -1}
        data-radiocard=""
        data-name={name}
        data-value={value}
        className={cls}
        onClick={() => !disabled && setValue(value)}
        onKeyDown={onKeyDown}
        {...rest}
      >
        {Icon ? (
          <span className="u-radiocard__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        ) : null}
        <span className="u-radiocard__body">
          <span className="u-radiocard__label">{label}</span>
          {description ? (
            <span className="u-radiocard__desc">{description}</span>
          ) : null}
        </span>
        <span
          className={['u-radiocard__indicator', `u-radiocard__indicator--${indicator}`]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          {indicator === 'check' && checked ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      </button>
    );
  },
);

/* ============================================================================
 * Rating (star rating)
 * ========================================================================== */

export type RatingSize = 'sm' | 'md' | 'lg';

const RATING_PX: Record<RatingSize, number> = { sm: 14, md: 18, lg: 24 };

export interface RatingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current rating (number of filled stars). */
  value: number;
  onChange?: (value: number) => void;
  /** Total stars. */
  max?: number;
  readOnly?: boolean;
  size?: RatingSize;
  /** Accessible name, e.g. "Product rating". */
  label?: string;
  /** Allow clicking a filled star again to clear back to 0. */
  allowClear?: boolean;
}

/**
 * A star rating. Controlled via `value` / `onChange`. Read-only mode renders an
 * `img` with a text alt; interactive mode is a `slider` (arrows change value,
 * Home/End jump to the ends).
 */
export const Rating = React.forwardRef<HTMLDivElement, RatingProps>(function Rating(
  { value, onChange, max = 5, readOnly = false, size = 'md', label = 'Rating', allowClear = true, className, ...rest },
  ref,
) {
  const [hover, setHover] = React.useState<number | null>(null);
  const px = RATING_PX[size];
  const shown = hover ?? value;

  const commit = (next: number): void => {
    if (readOnly || !onChange) return;
    const clamped = Math.max(0, Math.min(max, next));
    onChange(allowClear && clamped === value ? 0 : clamped);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (readOnly || !onChange) return;
    // Keyboard sets ABSOLUTE values (clamped) per the ARIA slider pattern — it
    // intentionally does NOT use the pointer-only allowClear toggle, so e.g.
    // pressing End at max stays at max instead of clearing. Home gives 0.
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        onChange(Math.min(max, value + 1));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        onChange(Math.max(0, value - 1));
        break;
      case 'Home':
        e.preventDefault();
        onChange(0);
        break;
      case 'End':
        e.preventDefault();
        onChange(max);
        break;
      default:
        break;
    }
  };

  const cls = ['u-rating', `u-rating--${size}`, readOnly && 'is-readonly', className]
    .filter(Boolean)
    .join(' ');

  const ariaText = `${value} of ${max} stars`;

  return (
    <div
      ref={ref}
      className={cls}
      role={readOnly ? 'img' : 'slider'}
      aria-label={readOnly ? `${label}: ${ariaText}` : label}
      aria-valuemin={readOnly ? undefined : 0}
      aria-valuemax={readOnly ? undefined : max}
      aria-valuenow={readOnly ? undefined : value}
      aria-valuetext={readOnly ? undefined : ariaText}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHover(null)}
      {...rest}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= shown;
        return (
          <button
            key={starValue}
            type="button"
            tabIndex={-1}
            disabled={readOnly}
            aria-hidden="true"
            className={['u-rating__star', filled && 'is-filled'].filter(Boolean).join(' ')}
            onClick={() => commit(starValue)}
            onMouseEnter={() => !readOnly && setHover(starValue)}
            onFocus={() => !readOnly && setHover(starValue)}
          >
            <Star
              size={px}
              strokeWidth={1.75}
              fill={filled ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
});

/* ============================================================================
 * OtpInput
 * ========================================================================== */

export interface OtpInputProps {
  /** Number of single-character boxes. */
  length?: number;
  /** Current value (controlled). Longer values are truncated to `length`. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once every box is filled. */
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  /** Render dots instead of the characters (e.g. a PIN). */
  mask?: boolean;
  disabled?: boolean;
  /** Restrict allowed characters. Defaults to digits only. */
  pattern?: RegExp;
  /** Group accessible name. */
  label?: string;
  className?: string;
}

/**
 * An N-box one-time-code input. Paste fills across boxes from the focused
 * position, Arrow/Backspace navigate, and each box carries its own aria-label.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  autoFocus = false,
  mask = false,
  disabled = false,
  pattern = /^[0-9]$/,
  label = 'One-time code',
  className,
}: OtpInputProps): React.JSX.Element {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const chars = React.useMemo(() => {
    const arr = value.slice(0, length).split('');
    return Array.from({ length }, (_, i) => arr[i] ?? '');
  }, [value, length]);

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setChars = (next: string[]): void => {
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (joined.length === length && next.every(Boolean)) onComplete?.(joined);
  };

  const focusBox = (i: number): void => {
    const clamped = Math.max(0, Math.min(length - 1, i));
    const el = refs.current[clamped];
    el?.focus();
    el?.select();
  };

  const handleChange = (i: number, raw: string): void => {
    // Keep only the last typed character that matches the pattern.
    const ch = raw.slice(-1);
    if (ch && !pattern.test(ch)) return;
    const next = [...chars];
    next[i] = ch;
    setChars(next);
    if (ch) focusBox(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault();
        const next = [...chars];
        if (next[i]) {
          next[i] = '';
          setChars(next);
        } else if (i > 0) {
          next[i - 1] = '';
          setChars(next);
          focusBox(i - 1);
        }
        break;
      }
      case 'Delete': {
        e.preventDefault();
        const next = [...chars];
        next[i] = '';
        setChars(next);
        break;
      }
      case 'ArrowLeft':
        e.preventDefault();
        focusBox(i - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusBox(i + 1);
        break;
      case 'Home':
        e.preventDefault();
        focusBox(0);
        break;
      case 'End':
        e.preventDefault();
        focusBox(length - 1);
        break;
      default:
        break;
    }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .split('')
      .filter((c) => pattern.test(c));
    if (pasted.length === 0) return;
    const next = [...chars];
    let cursor = i;
    for (const c of pasted) {
      if (cursor >= length) break;
      next[cursor] = c;
      cursor += 1;
    }
    setChars(next);
    // After a paste that reaches the end, keep focus on the last box (clamp)
    // rather than addressing an out-of-range index.
    focusBox(Math.min(cursor, length - 1));
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={['u-otp', className].filter(Boolean).join(' ')}
    >
      {chars.map((ch, i) => (
        <input
          // Boxes are positional and have no stable id; index is the key.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type={mask ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={ch}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          className={['u-otp__box', ch && 'is-filled'].filter(Boolean).join(' ')}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

/* ============================================================================
 * SearchInput
 * ========================================================================== */

export type SearchInputSize = 'sm' | 'md' | 'lg';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  /** Fired on every keystroke (raw input value). */
  onValueChange?: (value: string) => void;
  /** Fired after `debounce` ms of no typing. Use for live search. */
  onSearch?: (value: string) => void;
  /** Debounce window for `onSearch`, in ms. */
  debounce?: number;
  inputSize?: SearchInputSize;
  /** Optional shortcut hint shown on the right, e.g. "⌘K". Hidden once typing. */
  shortcut?: React.ReactNode;
  /** Accessible label for the clear button. */
  clearLabel?: string;
}

/**
 * A search field with a leading icon, a clear button (shown when non-empty), an
 * optional shortcut hint, and a debounced `onSearch`. Works controlled or
 * uncontrolled. The native `type="search"` gives Escape-to-clear for free.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value: valueProp,
      defaultValue,
      onValueChange,
      onSearch,
      debounce = 250,
      inputSize = 'md',
      shortcut,
      clearLabel = 'Clear search',
      placeholder = 'Search',
      className,
      disabled,
      id,
      ...rest
    },
    forwardedRef,
  ) {
    const isControlled = valueProp !== undefined;
    const [internal, setInternal] = React.useState(defaultValue ?? '');
    const value = isControlled ? valueProp : internal;

    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

    // Debounce onSearch. We keep the latest callback in a ref so the timer
    // effect does not re-run (and reset the timer) on every render.
    const onSearchRef = React.useRef(onSearch);
    React.useEffect(() => {
      onSearchRef.current = onSearch;
    });
    React.useEffect(() => {
      if (!onSearchRef.current) return;
      const t = window.setTimeout(() => onSearchRef.current?.(value), debounce);
      return () => window.clearTimeout(t);
    }, [value, debounce]);

    const update = (next: string): void => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    };

    const clear = (): void => {
      update('');
      onSearchRef.current?.('');
      innerRef.current?.focus();
    };

    const iconPx = inputSize === 'sm' ? 13 : inputSize === 'lg' ? 16 : 14;
    const showShortcut = shortcut != null && value.length === 0;

    return (
      <div
        className={[
          'u-search',
          `u-search--${inputSize}`,
          disabled && 'is-disabled',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Search size={iconPx} className="u-search__icon" aria-hidden="true" />
        <input
          ref={innerRef}
          id={id}
          type="search"
          role="searchbox"
          className="u-search__control"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => update(e.target.value)}
          {...rest}
        />
        {value.length > 0 ? (
          <button
            type="button"
            className="u-search__clear"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={clear}
            disabled={disabled}
          >
            <X size={iconPx} aria-hidden="true" />
          </button>
        ) : showShortcut ? (
          <kbd className="u-search__hint" aria-hidden="true">
            {shortcut}
          </kbd>
        ) : null}
      </div>
    );
  },
);

export default SearchInput;
