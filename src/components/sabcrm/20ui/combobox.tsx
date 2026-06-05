'use client';

/**
 * 20ui — Combobox (autocomplete).
 *
 * A text input that filters a portal-rendered list as you type; pick a row to
 * fill the input. Built on `StPortalPopover` so the list escapes any clipping
 * ancestor (sidebars, dialogs) and inherits the shared scale-in + elevation.
 *
 * It implements the full ARIA combobox pattern (list autocomplete):
 *   - input is `role="combobox"` with `aria-expanded`, `aria-controls`,
 *     `aria-autocomplete="list"` and `aria-activedescendant` tracking the
 *     virtually-focused option;
 *   - the panel is `role="listbox"`; rows are `role="option"` with
 *     `aria-selected`;
 *   - keyboard: Arrow up/down move the active option (and open the list),
 *     Home/End jump to the ends, Enter picks the active option, Escape closes
 *     (then a second Escape clears), Tab commits and closes.
 *
 * Options can be static (`options`) or fetched (`onSearch`, debounced). With
 * `allowCustom`, free text that doesn't match an option is still committed on
 * Enter / blur so the field accepts ad-hoc values (e.g. a new tag name).
 */

import * as React from 'react';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';

import { StPortalPopover, type StPopoverAlign } from '@/components/sabcrm/twenty/st-portal-popover';

import './combobox.css';

export interface ComboboxOption {
  /** Stable identity + the value committed via onChange. */
  value: string;
  /** Visible row text. Defaults to `value`. */
  label?: string;
  /** Optional secondary line under the label (e.g. an email). */
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue' | 'children'
  > {
  /** Selected option value (controlled). */
  value?: string | null;
  /** Fired when an option is picked (or custom text committed). */
  onChange?: (value: string, option: ComboboxOption | null) => void;
  /** Static option set. Ignored when `onSearch` is provided. */
  options?: ComboboxOption[];
  /**
   * Async resolver: given the current query, return matching options. Debounced
   * by `debounceMs`. When set, filtering is delegated to the resolver.
   */
  onSearch?: (query: string) => Promise<ComboboxOption[]>;
  /** Debounce window for `onSearch`, in ms. */
  debounceMs?: number;
  placeholder?: string;
  /** Shown when there are no matching options (and not loading). */
  emptyText?: React.ReactNode;
  /** Accept free text that matches no option (committed on Enter / blur). */
  allowCustom?: boolean;
  /** Horizontal edge of the input the panel aligns to. */
  align?: StPopoverAlign;
  disabled?: boolean;
  invalid?: boolean;
  /** Accessible name when no surrounding label exists. */
  'aria-label'?: string;
  id?: string;
  name?: string;
}

const labelOf = (o: ComboboxOption): string => o.label ?? o.value;

/** Case-insensitive substring filter over a static option set. */
function filterStatic(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => {
    const hay = `${labelOf(o)} ${o.description ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(
  function Combobox(
    {
      value = null,
      onChange,
      options,
      onSearch,
      debounceMs = 220,
      placeholder = 'Search...',
      emptyText = 'No results',
      allowCustom = false,
      align = 'start',
      disabled = false,
      invalid = false,
      className,
      id,
      name,
      'aria-label': ariaLabel,
      ...rest
    },
    forwardedRef,
  ) {
    const reactId = React.useId();
    const baseId = id ?? `cmb-${reactId}`;
    const listboxId = `${baseId}-listbox`;
    const optionId = (i: number): string => `${baseId}-opt-${i}`;

    const anchorRef = React.useRef<HTMLDivElement>(null);
    const innerInputRef = React.useRef<HTMLInputElement>(null);
    const blurTimeoutRef = React.useRef<number | null>(null);
    // Clear any pending blur-commit timer on unmount so it can never fire after
    // the component is gone (no stale state writes / leaked timers).
    React.useEffect(
      () => () => {
        if (blurTimeoutRef.current != null) window.clearTimeout(blurTimeoutRef.current);
      },
      [],
    );
    // Merge the forwarded ref with the internal one so callers can focus it.
    const setInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerInputRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const [open, setOpen] = React.useState(false);
    // The text in the box. When closed, it reflects the selected option's label.
    const [query, setQuery] = React.useState('');
    const [active, setActive] = React.useState(0);
    const [results, setResults] = React.useState<ComboboxOption[]>(options ?? []);
    const [loading, setLoading] = React.useState(false);

    const isAsync = typeof onSearch === 'function';

    // Resolve the currently-selected option's label for the closed state.
    const selectedOption = React.useMemo<ComboboxOption | null>(() => {
      if (value == null) return null;
      const pool = options ?? results;
      return pool.find((o) => o.value === value) ?? { value };
    }, [value, options, results]);

    // What the input shows: live query while open, the selected label while closed.
    const displayValue = open ? query : selectedOption ? labelOf(selectedOption) : '';

    // ----- Static filtering -----
    React.useEffect(() => {
      if (isAsync || !open) return;
      setResults(filterStatic(options ?? [], query));
      setActive(0);
    }, [isAsync, open, options, query]);

    // ----- Async filtering (debounced) -----
    React.useEffect(() => {
      if (!isAsync || !open) return;
      let cancelled = false;
      setLoading(true);
      const handle = window.setTimeout(() => {
        Promise.resolve(onSearch!(query))
          .then((res) => {
            if (cancelled) return;
            setResults(res);
            setActive(0);
          })
          .catch(() => {
            if (!cancelled) setResults([]);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      }, debounceMs);
      return () => {
        cancelled = true;
        window.clearTimeout(handle);
      };
    }, [isAsync, open, query, debounceMs, onSearch]);

    const enabled = React.useMemo(
      () => results.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled),
      [results],
    );

    const openList = React.useCallback(() => {
      if (disabled) return;
      setOpen(true);
    }, [disabled]);

    const close = React.useCallback(() => {
      setOpen(false);
      setQuery('');
    }, []);

    const commit = React.useCallback(
      (opt: ComboboxOption) => {
        onChange?.(opt.value, opt);
        setOpen(false);
        setQuery('');
        innerInputRef.current?.focus();
      },
      [onChange],
    );

    const commitCustom = React.useCallback(() => {
      const text = query.trim();
      if (!allowCustom || !text) return false;
      // Prefer an exact (case-insensitive) match over a fresh custom value.
      const exact = results.find((o) => labelOf(o).toLowerCase() === text.toLowerCase());
      commit(exact ?? { value: text, label: text });
      return true;
    }, [allowCustom, query, results, commit]);

    // Move the active option, skipping disabled rows, wrapping at the ends.
    const move = React.useCallback(
      (dir: 1 | -1) => {
        if (enabled.length === 0) return;
        const positions = enabled.map(({ i }) => i);
        const cur = positions.indexOf(active);
        const next = (cur + dir + positions.length) % positions.length;
        setActive(positions[next]);
      },
      [enabled, active],
    );

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!open) {
            openList();
          } else {
            move(1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!open) {
            openList();
          } else {
            move(-1);
          }
          break;
        case 'Home':
          if (open && enabled.length) {
            e.preventDefault();
            setActive(enabled[0].i);
          }
          break;
        case 'End':
          if (open && enabled.length) {
            e.preventDefault();
            setActive(enabled[enabled.length - 1].i);
          }
          break;
        case 'Enter': {
          if (!open) return;
          e.preventDefault();
          const opt = results[active];
          if (opt && !opt.disabled) commit(opt);
          else commitCustom();
          break;
        }
        case 'Escape':
          if (open) {
            e.preventDefault();
            // First Escape closes; if already closed, clear the selection.
            close();
          } else if (value != null) {
            e.preventDefault();
            onChange?.('', null);
          }
          break;
        case 'Tab':
          // Commit any pending custom text, then let focus leave naturally.
          if (open) {
            commitCustom();
            setOpen(false);
            setQuery('');
          }
          break;
        default:
          break;
      }
    };

    const onInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (!open) setOpen(true);
      setQuery(e.target.value);
    };

    const onBlur = (): void => {
      // Defer so a click on an option (which blurs the input) still commits.
      if (blurTimeoutRef.current != null) window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = window.setTimeout(() => {
        blurTimeoutRef.current = null;
        if (anchorRef.current?.contains(document.activeElement)) return;
        if (open) {
          if (allowCustom) commitCustom();
          close();
        }
      }, 0);
    };

    const hasActive = open && results[active] != null && !results[active]?.disabled;
    const showEmpty = open && !loading && results.length === 0;

    return (
      <div
        ref={anchorRef}
        className={['u-combobox', invalid && 'is-invalid', disabled && 'is-disabled', className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        <Search size={14} className="u-combobox__lead" aria-hidden="true" />
        <input
          ref={setInputRef}
          id={baseId}
          name={name}
          type="text"
          className="u-combobox__input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={hasActive ? optionId(active) : undefined}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={openList}
          onClick={openList}
          onBlur={onBlur}
        />
        {loading ? (
          <Loader2 size={14} className="u-combobox__spin" aria-hidden="true" />
        ) : (
          <ChevronDown
            size={14}
            className={['u-combobox__caret', open && 'is-open'].filter(Boolean).join(' ')}
            aria-hidden="true"
          />
        )}

        <StPortalPopover
          anchorRef={anchorRef}
          open={open}
          onClose={() => {
            // Outside-click / Escape from the portal: commit custom then close.
            if (allowCustom) commitCustom();
            close();
          }}
          align={align}
          matchWidth
          role="presentation"
          className={['u-combobox-pop', className].filter(Boolean).join(' ')}
        >
          {/* Keep DOM focus on the input; the listbox is virtually focused. */}
          <ul className="u-combobox__list" id={listboxId} role="listbox" aria-label={ariaLabel}>
            {showEmpty ? (
              <li className="u-combobox__empty" role="presentation">
                {emptyText}
              </li>
            ) : (
              results.map((opt, i) => {
                const isActive = i === active && !opt.disabled;
                const isSelected = value != null && opt.value === value;
                return (
                  <li
                    key={`${opt.value}-${i}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    className={[
                      'u-combobox__option',
                      isActive && 'is-active',
                      isSelected && 'is-selected',
                      opt.disabled && 'is-disabled',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    // pointerdown (not click) fires before the input's blur, so
                    // the selection lands without a focus race.
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (!opt.disabled) commit(opt);
                    }}
                    onMouseEnter={() => !opt.disabled && setActive(i)}
                  >
                    <span className="u-combobox__option-main">
                      <span className="u-combobox__option-label">{labelOf(opt)}</span>
                      {opt.description ? (
                        <span className="u-combobox__option-desc">{opt.description}</span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check size={15} className="u-combobox__check" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </StPortalPopover>
      </div>
    );
  },
);

export default Combobox;
