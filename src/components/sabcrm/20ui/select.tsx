'use client';

/**
 * 20ui — Select + MultiSelect.
 *
 * The styled dropdown family. A native `<select>` cannot render icons, chips, a
 * search box, or the calm Twenty surface, so these are custom widgets built to
 * the full listbox ARIA pattern over `StPortalPopover` (which escapes clipping
 * ancestors and scale-ins from its anchored edge for free).
 *
 * - `Select` — single value. The trigger shows the current option (icon + label)
 *   or the placeholder, plus a chevron. Opening reveals a `role="listbox"` of
 *   `role="option"` rows with `aria-selected`. Optional `searchable` adds a
 *   type-to-filter input; `clearable` adds an inline clear affordance.
 * - `MultiSelect` — many values. Same listbox, but selected options render as
 *   removable chips inside the trigger and stay open across picks.
 *
 * Keyboard model: Enter / Space / ArrowDown open; ArrowUp / ArrowDown move the
 * active option; Enter picks; Escape closes and restores focus to the trigger;
 * typing filters when `searchable`. Both controls read the form `FieldContext`
 * (see ./field) so dropping one inside a `<Field>` inherits the generated id /
 * described-by / invalid state with no prop threading.
 */

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { StPortalPopover } from './portal-popover';
import { renderIcon, type IconProp } from './_icon';
import { useFieldContext } from './field';
import './select.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type SelectSize = 'sm' | 'md';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading icon (e.g. a status glyph). */
  icon?: IconProp;
  disabled?: boolean;
}

/* ----------------------------------------------------------- shared listbox */

interface ListboxProps {
  /** Anchor the popover to the trigger. */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  options: SelectOption[];
  /** Currently selected values (one for Select, many for MultiSelect). */
  selected: Set<string>;
  /** Pick / toggle a value. */
  onPick: (value: string) => void;
  /** Accessible name for the listbox. */
  label: string;
  searchable: boolean;
  size: SelectSize;
  /** Stable id for the listbox element (the trigger's aria-controls target). */
  listboxId: string;
  /** Notify the trigger of the active option's id for aria-activedescendant. */
  onActiveChange: (id: string | undefined) => void;
  /** When false, picking does not close (multi-select stays open). */
  closeOnPick: boolean;
}

/**
 * The portal panel: an optional search box above a roving-active `role="listbox"`.
 * Focus lives on the search input (searchable) or on the listbox itself, and the
 * active option is tracked virtually via `aria-activedescendant` so screen
 * readers announce moves without stealing DOM focus from the search field.
 */
function Listbox({
  anchorRef,
  open,
  onClose,
  options,
  selected,
  onPick,
  label,
  searchable,
  size,
  listboxId,
  onActiveChange,
  closeOnPick,
}: ListboxProps): React.JSX.Element {
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // First enabled option in the filtered set — the default active row.
  const firstEnabled = React.useCallback(
    (list: SelectOption[]) => list.findIndex((o) => !o.disabled),
    [],
  );

  // Reset query + active row each time the panel opens.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(Math.max(0, firstEnabled(filtered)));
  }, [filtered, firstEnabled]);

  // Move focus into the panel once it has painted.
  React.useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else listRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, searchable]);

  const optionId = React.useCallback(
    (index: number) => `${listboxId}-opt-${index}`,
    [listboxId],
  );

  const activeOption = filtered[activeIndex];
  React.useEffect(() => {
    onActiveChange(activeOption ? optionId(activeIndex) : undefined);
  }, [activeOption, activeIndex, optionId, onActiveChange]);

  // Keep the active row scrolled into view as the user arrows through.
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex))}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, optionId]);

  const step = React.useCallback(
    (dir: 1 | -1) => {
      setActiveIndex((curr) => {
        const n = filtered.length;
        if (n === 0) return curr;
        let i = curr;
        for (let k = 0; k < n; k += 1) {
          i = (i + dir + n) % n;
          if (!filtered[i]?.disabled) return i;
        }
        return curr;
      });
    },
    [filtered],
  );

  const pickActive = React.useCallback(() => {
    const opt = filtered[activeIndex];
    if (!opt || opt.disabled) return;
    onPick(opt.value);
    if (closeOnPick) onClose();
  }, [filtered, activeIndex, onPick, closeOnPick, onClose]);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        step(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(Math.max(0, firstEnabled(filtered)));
        break;
      case 'End': {
        e.preventDefault();
        const last = [...filtered].reverse().findIndex((o) => !o.disabled);
        if (last >= 0) setActiveIndex(filtered.length - 1 - last);
        break;
      }
      case 'Enter':
        e.preventDefault();
        pickActive();
        break;
      case 'Tab':
        // A select traps Tab: close so the page tab order resumes from the trigger.
        onClose();
        break;
      default:
        break;
    }
  };

  return (
    <StPortalPopover
      anchorRef={anchorRef}
      open={open}
      onClose={onClose}
      align="start"
      matchWidth
      ariaLabel={label}
      role="presentation"
      className={cx('u-select__panel', `u-select__panel--${size}`)}
    >
      {searchable ? (
        <div className="u-select__search">
          <Search size={14} className="u-select__search-icon" aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            className="u-select__search-input"
            placeholder="Search"
            value={query}
            // role=combobox semantics: the input controls the listbox below.
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
            aria-label={`Search ${label}`}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      ) : null}

      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={label}
        aria-multiselectable={!closeOnPick || undefined}
        aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
        // The listbox is focusable only when there is no search box to hold focus.
        tabIndex={searchable ? -1 : 0}
        className="u-select__list"
        onKeyDown={searchable ? undefined : onKeyDown}
      >
        {filtered.length === 0 ? (
          <div className="u-select__empty" role="presentation">
            No matches
          </div>
        ) : (
          filtered.map((opt, index) => {
            const isSelected = selected.has(opt.value);
            const isActive = index === activeIndex;
            return (
              <div
                key={opt.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                className={cx(
                  'u-select__option',
                  isActive && 'is-active',
                  isSelected && 'is-selected',
                  opt.disabled && 'is-disabled',
                )}
                // Pointer-driven selection mirrors the keyboard path.
                onMouseEnter={() => !opt.disabled && setActiveIndex(index)}
                onMouseDown={(e) => {
                  // Keep focus on the search input / listbox; prevent blur-close.
                  e.preventDefault();
                }}
                onClick={() => {
                  if (opt.disabled) return;
                  onPick(opt.value);
                  if (closeOnPick) onClose();
                }}
              >
                {renderIcon(opt.icon, { size: 15, className: 'u-select__option-icon', 'aria-hidden': true })}
                <span className="u-select__option-label">{opt.label}</span>
                {isSelected ? (
                  <Check size={15} className="u-select__option-check" aria-hidden="true" />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </StPortalPopover>
  );
}

/* ----------------------------------------------------------------- Select */

export interface SelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onChange' | 'value' | 'defaultValue' | 'children'
  > {
  /** Controlled selected value. */
  value?: string | null;
  /** Fired with the picked value (or null when cleared). */
  onChange?: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: SelectSize;
  disabled?: boolean;
  invalid?: boolean;
  /** Add a type-to-filter search box above the options. */
  searchable?: boolean;
  /** Add an inline clear button when a value is selected. */
  clearable?: boolean;
  /**
   * Stretch the trigger to fill its container. Defaults to `true` when inside a
   * `<Field>` (form fields), `false` otherwise — so a Select dropped into a
   * toolbar / inline row sizes to its content instead of stretching and
   * breaking the layout. Pass explicitly to override.
   */
  block?: boolean;
  /** Accessible name when not wrapped in a `<Field>`. */
  'aria-label'?: string;
}

/**
 * A single-select dropdown.
 *
 *   <Select
 *     value={stage}
 *     onChange={setStage}
 *     placeholder="Select stage"
 *     options={[
 *       { value: 'new', label: 'New' },
 *       { value: 'won', label: 'Won', icon: Trophy },
 *     ]}
 *   />
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value = null,
    onChange,
    options,
    placeholder = 'Select',
    size = 'md',
    disabled = false,
    invalid,
    searchable = false,
    clearable = false,
    block,
    className,
    id,
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const field = useFieldContext();
  const resolvedId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid ?? false;
  // Full-width when explicitly requested, or by default inside a Field (forms).
  const fullWidth = block ?? field != null;

  const anchorRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [activeDesc, setActiveDesc] = React.useState<string | undefined>(undefined);
  const listboxId = `${React.useId()}-listbox`;

  const selected = React.useMemo(
    () => new Set(value != null ? [value] : []),
    [value],
  );
  const current = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const close = React.useCallback(() => {
    setOpen(false);
    setActiveDesc(undefined);
    // Return focus to the trigger so keyboard users keep their place.
    anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  const pick = React.useCallback(
    (next: string) => {
      onChange?.(next);
    },
    [onChange],
  );

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (open) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <div
        ref={anchorRef}
        className={cx('u-select__anchor', fullWidth && 'u-select__anchor--block')}
      >
        <button
          ref={ref}
          id={resolvedId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open ? activeDesc : undefined}
          aria-invalid={isInvalid || undefined}
          aria-describedby={field?.describedBy}
          aria-label={ariaLabel}
          aria-required={field?.required || undefined}
          disabled={disabled}
          className={cx(
            'u-select',
            `u-select--${size}`,
            isInvalid && 'is-invalid',
            open && 'is-open',
            className,
          )}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          {...rest}
        >
          {renderIcon(current?.icon, { size: 15, className: 'u-select__value-icon', 'aria-hidden': true })}
          <span className={cx('u-select__value', !current && 'is-placeholder')}>
            {current ? current.label : placeholder}
          </span>
          {clearable && current && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              className="u-select__clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.(null);
              }}
            >
              <X size={14} aria-hidden="true" />
            </span>
          ) : null}
          <ChevronDown size={15} className="u-select__chevron" aria-hidden="true" />
        </button>
      </div>

      <Listbox
        anchorRef={anchorRef}
        open={open}
        onClose={close}
        options={options}
        selected={selected}
        onPick={pick}
        label={ariaLabel ?? placeholder}
        searchable={searchable}
        size={size}
        listboxId={listboxId}
        onActiveChange={setActiveDesc}
        closeOnPick
      />
    </>
  );
});

/* ------------------------------------------------------------- MultiSelect */

export interface MultiSelectProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue' | 'children'
  > {
  /** Controlled selected values. */
  value?: string[];
  onChange?: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: SelectSize;
  disabled?: boolean;
  invalid?: boolean;
  searchable?: boolean;
  /** Fill the container (default true inside a `<Field>`, false otherwise). */
  block?: boolean;
  /** Accessible name when not wrapped in a `<Field>`. */
  'aria-label'?: string;
}

/**
 * A multi-select dropdown. Selected options render as removable chips inside the
 * trigger; the listbox stays open across picks so several values can be chosen
 * in one pass.
 *
 *   <MultiSelect
 *     value={tags}
 *     onChange={setTags}
 *     placeholder="Add tags"
 *     options={[
 *       { value: 'vip', label: 'VIP' },
 *       { value: 'renewal', label: 'Renewal' },
 *     ]}
 *   />
 */
export function MultiSelect({
  value = [],
  onChange,
  options,
  placeholder = 'Select',
  size = 'md',
  disabled = false,
  invalid,
  searchable = false,
  block,
  className,
  id,
  'aria-label': ariaLabel,
  ...rest
}: MultiSelectProps): React.JSX.Element {
  const field = useFieldContext();
  const resolvedId = id ?? field?.controlId;
  const isInvalid = invalid ?? field?.invalid ?? false;
  const fullWidth = block ?? field != null;

  const anchorRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [activeDesc, setActiveDesc] = React.useState<string | undefined>(undefined);
  const listboxId = `${React.useId()}-listbox`;

  const selected = React.useMemo(() => new Set(value), [value]);
  const chips = React.useMemo(
    () => value.map((v) => options.find((o) => o.value === v)).filter((o): o is SelectOption => Boolean(o)),
    [value, options],
  );

  const close = React.useCallback(() => {
    setOpen(false);
    setActiveDesc(undefined);
    triggerRef.current?.focus();
  }, []);

  const toggle = React.useCallback(
    (next: string) => {
      const set = new Set(value);
      if (set.has(next)) set.delete(next);
      else set.add(next);
      onChange?.([...set]);
    },
    [value, onChange],
  );

  const remove = React.useCallback(
    (v: string) => onChange?.(value.filter((x) => x !== v)),
    [value, onChange],
  );

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    // Backspace on an empty-ish trigger removes the last chip (common pattern).
    if (!open && e.key === 'Backspace' && chips.length > 0) {
      e.preventDefault();
      remove(chips[chips.length - 1]!.value);
    }
  };

  return (
    <>
      <div
        ref={anchorRef}
        className={cx('u-select__anchor', fullWidth && 'u-select__anchor--block')}
      >
        <button
          ref={triggerRef}
          id={resolvedId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={open ? activeDesc : undefined}
          aria-invalid={isInvalid || undefined}
          aria-describedby={field?.describedBy}
          aria-label={ariaLabel}
          aria-required={field?.required || undefined}
          disabled={disabled}
          className={cx(
            'u-select',
            'u-select--multi',
            `u-select--${size}`,
            isInvalid && 'is-invalid',
            open && 'is-open',
            chips.length > 0 && 'has-chips',
            className,
          )}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {chips.length === 0 ? (
            <span className="u-select__value is-placeholder">{placeholder}</span>
          ) : (
            <span className="u-select__chips">
              {chips.map((opt) => {
                return (
                  <span key={opt.value} className="u-select__chip">
                    {renderIcon(opt.icon, { size: 12, className: 'u-select__chip-icon', 'aria-hidden': true })}
                    <span className="u-select__chip-label">{opt.label}</span>
                    {!disabled ? (
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`Remove ${opt.label}`}
                        className="u-select__chip-remove"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(opt.value);
                        }}
                      >
                        <X size={12} aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </span>
          )}
          <ChevronDown size={15} className="u-select__chevron" aria-hidden="true" />
        </button>
      </div>

      <Listbox
        anchorRef={anchorRef}
        open={open}
        onClose={close}
        options={options}
        selected={selected}
        onPick={toggle}
        label={ariaLabel ?? placeholder}
        searchable={searchable}
        size={size}
        listboxId={listboxId}
        onActiveChange={setActiveDesc}
        closeOnPick={false}
      />
    </>
  );
}

export default Select;
