'use client';

/**
 * StSelect — the SabCRM Twenty-style single-select dropdown.
 *
 * Replaces the raw native `<select className="st-select">` used across the CRM
 * (create dialog, filters, settings) with a controlled, portal-rendered control
 * that matches Twenty's dropdown affordances:
 *   - a trigger that shows the selected option (with an optional colour dot or
 *     avatar) or a placeholder + chevron,
 *   - a portal popover ({@link StPortalPopover}) that never clips against
 *     `overflow:hidden` ancestors,
 *   - type-to-filter search (auto-enabled past 7 options, overridable),
 *   - full keyboard support (↑/↓ to move, Enter to pick, Esc to close, typing
 *     focuses the search box),
 *   - an optional clear affordance.
 *
 * It is intentionally presentation-only: callers own the option list (including
 * any async loading) and the selected `value`. Option ids are opaque strings —
 * record ids for RELATION pickers, enum values for SELECT fields.
 */

import * as React from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

import { TwentyAvatar, type TwentyAvatarShape } from './twenty-primitives';
import { StPortalPopover } from './st-portal-popover';

export type StSelectOption = {
  value: string;
  label: string;
  /** Colour dot (SELECT enums / tags). */
  color?: string;
  /** Avatar (RELATION pickers — people/companies/members). */
  avatar?: { name: string; src?: string; shape?: TwentyAvatarShape };
  /** Secondary line under the label. */
  description?: string;
  disabled?: boolean;
};

export type StSelectProps = {
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: StSelectOption[];
  placeholder?: string;
  /** Force search box on/off. Defaults to on when there are > 7 options. */
  searchable?: boolean;
  /** Render a clear (×) button when a value is selected. */
  allowClear?: boolean;
  disabled?: boolean;
  /** Shown in the popover when there are no (matching) options. */
  emptyText?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
};

export function StSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchable,
  allowClear = false,
  disabled = false,
  emptyText = 'No options',
  ariaLabel,
  id,
  className,
}: StSelectProps): React.JSX.Element {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);

  const showSearch = searchable ?? options.length > 7;
  const selected = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Reset transient state each time the popover opens; focus the search box.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = Math.max(0, filtered.findIndex((o) => o.value === value));
    setActiveIdx(idx);
    if (showSearch) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the active index in range as the filtered list changes.
  React.useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const commit = (opt: StSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) commit(opt);
    }
  };

  const renderOptionMedia = (opt: StSelectOption) => {
    if (opt.avatar) {
      return (
        <TwentyAvatar
          name={opt.avatar.name}
          src={opt.avatar.src}
          shape={opt.avatar.shape ?? 'round'}
          size="xs"
        />
      );
    }
    if (opt.color) {
      return <span className="st-select2__dot" style={{ background: opt.color }} aria-hidden="true" />;
    }
    return null;
  };

  return (
    <div className={['st-select2', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`st-select2__trigger${open ? ' st-select2__trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="st-select2__value">
          {selected ? (
            <>
              {renderOptionMedia(selected)}
              <span className="st-select2__value-label">{selected.label}</span>
            </>
          ) : (
            <span className="st-select2__placeholder">{placeholder}</span>
          )}
        </span>
        {allowClear && selected && !disabled ? (
          <span
            className="st-select2__clear"
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          >
            <X size={13} aria-hidden="true" />
          </span>
        ) : null}
        <ChevronDown size={14} className="st-select2__chevron" aria-hidden="true" />
      </button>

      <StPortalPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        align="start"
        matchWidth
        role="listbox"
        ariaLabel={ariaLabel}
        className="st-select2__popover"
      >
        {showSearch ? (
          <div className="st-select2__search">
            <Search size={13} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder="Search…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        ) : null}
        <div className="st-select2__list" role="presentation">
          {filtered.length === 0 ? (
            <div className="st-select2__empty">{emptyText}</div>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIdx;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  className={
                    'st-select2__option' +
                    (isActive ? ' st-select2__option--active' : '') +
                    (isSelected ? ' st-select2__option--selected' : '')
                  }
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => commit(opt)}
                >
                  {renderOptionMedia(opt)}
                  <span className="st-select2__option-text">
                    <span className="st-select2__option-label">{opt.label}</span>
                    {opt.description ? (
                      <span className="st-select2__option-desc">{opt.description}</span>
                    ) : null}
                  </span>
                  {isSelected ? <Check size={14} className="st-select2__check" aria-hidden="true" /> : null}
                </button>
              );
            })
          )}
        </div>
      </StPortalPopover>
    </div>
  );
}

export default StSelect;
