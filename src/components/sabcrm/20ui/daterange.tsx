'use client';

/**
 * 20ui — DateRangePicker.
 *
 * A field-styled trigger that opens the range-mode `Calendar` (from
 * `datepicker.tsx`) in a portal popover. The trigger reads as an `Input`: a
 * leading calendar icon, the chosen range shown as "start to end" with a small
 * arrow glyph between the two dates (no em-dash), and a trailing caret. Dates
 * are formatted with date-fns.
 *
 * We compose the existing `Calendar` rather than reimplement the grid, so all
 * keyboard navigation + ARIA (grid roles, aria-selected, month announcements)
 * comes from react-day-picker. The popover mounts to `document.body` via
 * `StPortalPopover`, which carries the `ui20 sabcrm-twenty` classes so tokens
 * resolve app-wide; it also owns outside-click + Escape dismissal and restores
 * focus to the trigger on close.
 *
 * Selecting closes the popover only once BOTH ends are chosen, so a half-picked
 * range stays open for the user to finish.
 *
 * Example:
 *   const [range, setRange] = React.useState<DateRange>();
 *   <DateRangePicker value={range} onChange={setRange} placeholder="Pick a range" />
 */

import * as React from 'react';
import { Calendar as CalendarIcon, MoveRight, ChevronDown, X } from 'lucide-react';
import type { DateRange, Matcher } from 'react-day-picker';
import { format as formatDate, isValid as isValidDate } from 'date-fns';

import { StPortalPopover } from '@/components/sabcrm/twenty/st-portal-popover';
import { Calendar } from './datepicker';

import './daterange.css';

export interface DateRangePickerProps {
  /** The current range. `undefined` (or no `from`) renders the placeholder. */
  value?: DateRange;
  /** Called with the next range as the user picks, or `undefined` when cleared. */
  onChange?: (range: DateRange | undefined) => void;
  /** Text shown when nothing is selected. e.g. "Select a date range". */
  placeholder?: string;
  /** Disable the whole control. */
  disabled?: boolean;
  /** date-fns format string for each end. Defaults to "PP" (e.g. Jun 5, 2026). */
  format?: string;
  /** Days that cannot be selected (a Date, an array, a predicate, or a range). */
  disabledDates?: Matcher | Matcher[];
  /** First day of the week (0 = Sunday). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Number of months to render side by side. Defaults to 2 for ranges. */
  numberOfMonths?: number;
  /** Accessible name for the trigger when there is no surrounding label. */
  'aria-label'?: string;
  id?: string;
  /** Posts the range to forms as "from.toISOString()/to.toISOString()". */
  name?: string;
  className?: string;
}

/** A valid Date, defensively guarding against a malformed value from props. */
function safeFormat(date: Date | undefined, fmt: string): string | null {
  if (!date || !isValidDate(date)) return null;
  return formatDate(date, fmt);
}

/**
 * Range field + portal popover calendar. The trigger is a native `<button>`
 * (fully keyboard operable); once open, react-day-picker owns arrow-key
 * navigation inside the grid.
 */
export const DateRangePicker = React.forwardRef<HTMLButtonElement, DateRangePickerProps>(
  function DateRangePicker(
    {
      value,
      onChange,
      placeholder = 'Select a date range',
      disabled = false,
      format: fmt = 'PP',
      disabledDates,
      weekStartsOn = 0,
      numberOfMonths = 2,
      id,
      name,
      className,
      'aria-label': ariaLabel,
      ...rest
    },
    ref,
  ) {
    const anchorRef = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(false);

    // Restore focus to the trigger on close (StPortalPopover handles the
    // dismissal; we own focus restoration so keyboard users land back here).
    const close = React.useCallback(() => {
      setOpen(false);
      anchorRef.current
        ?.querySelector<HTMLButtonElement>('.u-daterange__trigger')
        ?.focus();
    }, []);

    const from = safeFormat(value?.from, fmt);
    const to = safeFormat(value?.to, fmt);
    const hasValue = Boolean(from);

    // Mirror the selection into a hidden input so the control posts in forms.
    const hiddenValue =
      value?.from
        ? `${value.from.toISOString()}${value.to ? `/${value.to.toISOString()}` : ''}`
        : '';

    // Accessible label for the trigger when it shows real content (placeholder
    // is read directly otherwise). "Jun 1, 2026 to Jun 8, 2026".
    const valueLabel = hasValue
      ? to
        ? `${from} to ${to}`
        : `${from} to end`
      : null;

    const handleSelect = React.useCallback(
      (range: DateRange | undefined) => {
        onChange?.(range);
        // Close once a complete range exists; a half-picked range stays open.
        if (range?.from && range?.to) close();
      },
      [onChange, close],
    );

    const handleClear = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onChange?.(undefined);
      },
      [onChange],
    );

    return (
      <>
        <div
          ref={anchorRef}
          className={['u-daterange', className].filter(Boolean).join(' ')}
          {...rest}
        >
          <button
            ref={ref}
            id={id}
            type="button"
            className="u-daterange__trigger"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={ariaLabel ?? (valueLabel ? `Date range, ${valueLabel}` : placeholder)}
            data-placeholder={hasValue ? undefined : ''}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            <CalendarIcon size={15} className="u-daterange__icon" aria-hidden="true" />
            <span className="u-daterange__value">
              {hasValue ? (
                <>
                  <span className="u-daterange__date">{from}</span>
                  <MoveRight size={13} className="u-daterange__sep" aria-hidden="true" />
                  {to ? (
                    <span className="u-daterange__date">{to}</span>
                  ) : (
                    <span className="u-daterange__date u-daterange__date--pending">end date</span>
                  )}
                </>
              ) : (
                placeholder
              )}
            </span>
            {hasValue && !disabled ? (
              // Native nested button is invalid HTML, so this clear control is a
              // sibling overlay rendered outside the trigger (see below).
              <span className="u-daterange__caret-spacer" aria-hidden="true" />
            ) : (
              <ChevronDown size={14} className="u-daterange__caret" aria-hidden="true" />
            )}
          </button>

          {hasValue && !disabled ? (
            <button
              type="button"
              className="u-daterange__clear"
              aria-label="Clear date range"
              title="Clear"
              onClick={handleClear}
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}

          {name ? <input type="hidden" name={name} value={hiddenValue} readOnly /> : null}
        </div>

        <StPortalPopover
          anchorRef={anchorRef}
          open={open}
          onClose={close}
          align="start"
          role="dialog"
          ariaLabel="Choose a date range"
          className="u-daterange__pop"
        >
          <Calendar
            mode="range"
            value={value}
            onChange={handleSelect}
            disabled={disabledDates}
            weekStartsOn={weekStartsOn}
            numberOfMonths={numberOfMonths}
            autoFocus
          />
          <div className="u-daterange__footer">
            <span className="u-daterange__hint">
              {value?.from && !value?.to ? 'Pick the end date' : valueLabel ?? 'Pick a start date'}
            </span>
            <button
              type="button"
              className="u-daterange__footer-clear"
              onClick={() => onChange?.(undefined)}
              disabled={!hasValue}
            >
              Clear
            </button>
          </div>
        </StPortalPopover>
      </>
    );
  },
);

export type { DateRange, Matcher } from 'react-day-picker';

export default DateRangePicker;
