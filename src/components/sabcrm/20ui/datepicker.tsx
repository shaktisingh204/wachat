'use client';

/**
 * 20ui — Calendar + DatePicker.
 *
 * `Calendar` wraps react-day-picker v9 and skins it entirely with `--st-*`
 * tokens via a `u-cal__*` className map (today ring, accent selected fill,
 * range start/middle/end, muted outside days, weekday header, prev/next
 * IconButtons). All keyboard navigation and ARIA (grid roles, aria-selected,
 * aria-disabled, month announcements) come from react-day-picker.
 *
 * `DatePicker` is an `Input` with a leading calendar icon that opens the
 * `Calendar` in a portal-anchored popover (`StPortalPopover`, so it escapes any
 * clipping ancestor and the tokens resolve app-wide). The chosen date is
 * formatted with date-fns. Supports single and range modes.
 *
 * Example:
 *   const [day, setDay] = React.useState<Date>();
 *   <DatePicker value={day} onChange={setDay} placeholder="Pick a date" />
 */

import * as React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { DayPicker, type DateRange, type Matcher, type ChevronProps } from 'react-day-picker';
import { format as formatDate } from 'date-fns';

import { StPortalPopover } from '@/components/sabcrm/twenty/st-portal-popover';

import './datepicker.css';

/* ── react-day-picker className map → our token-skinned `u-cal__*` classes ───
   Keys are react-day-picker v9 UI / DayFlag / SelectionState element names.
   We supply a full set so none of the library's unstyled defaults leak in. */
const CAL_CLASS_NAMES = {
  root: 'u-cal',
  months: 'u-cal__months',
  month: 'u-cal__month',
  month_caption: 'u-cal__caption',
  caption_label: 'u-cal__caption-label',
  nav: 'u-cal__nav',
  button_previous: 'u-cal__nav-btn u-cal__nav-btn--prev',
  button_next: 'u-cal__nav-btn u-cal__nav-btn--next',
  month_grid: 'u-cal__grid',
  weekdays: 'u-cal__weekdays',
  weekday: 'u-cal__weekday',
  weeks: 'u-cal__weeks',
  week: 'u-cal__week',
  day: 'u-cal__day',
  day_button: 'u-cal__day-btn',
  today: 'u-cal__day--today',
  selected: 'u-cal__day--selected',
  outside: 'u-cal__day--outside',
  disabled: 'u-cal__day--disabled',
  hidden: 'u-cal__day--hidden',
  range_start: 'u-cal__day--range-start',
  range_middle: 'u-cal__day--range-middle',
  range_end: 'u-cal__day--range-end',
  dropdowns: 'u-cal__dropdowns',
  dropdown: 'u-cal__dropdown',
  dropdown_root: 'u-cal__dropdown-root',
  footer: 'u-cal__footer',
  week_number: 'u-cal__week-number',
  week_number_header: 'u-cal__week-number-header',
} as const;

/** Lucide chevrons in place of react-day-picker's default SVG, sized to tokens. */
function CalChevron({ orientation, className }: ChevronProps): React.JSX.Element {
  const Icon =
    orientation === 'left'
      ? ChevronLeft
      : orientation === 'right'
        ? ChevronRight
        : orientation === 'up'
          ? ChevronUp
          : ChevronDown;
  return <Icon size={16} className={className} aria-hidden="true" />;
}

export type CalendarMode = 'single' | 'range';

export interface CalendarBaseProps {
  /** Days that cannot be selected (a Date, an array, a predicate, or a range). */
  disabled?: Matcher | Matcher[];
  /** Hidden weekend? Number of months, week start, etc. pass straight through. */
  numberOfMonths?: number;
  /** 0 = Sunday … 1 = Monday. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Show the leading/trailing days of adjacent months (muted). */
  showOutsideDays?: boolean;
  /** Move focus into the grid on mount (used when opened in a popover). */
  autoFocus?: boolean;
  /**
   * Caption style. `'dropdown'` (default) shows month + year dropdowns so the
   * user can jump straight to any month/year instead of stepping one at a time;
   * `'label'` shows the plain month label with only the prev/next arrows.
   */
  captionLayout?: 'label' | 'dropdown' | 'dropdown-months' | 'dropdown-years';
  /** Earliest selectable month (also bounds the year dropdown). Default: 100y back. */
  startMonth?: Date;
  /** Latest selectable month (also bounds the year dropdown). Default: 10y ahead. */
  endMonth?: Date;
  className?: string;
}

export interface CalendarSingleProps extends CalendarBaseProps {
  mode?: 'single';
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

export interface CalendarRangeProps extends CalendarBaseProps {
  mode: 'range';
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

export type CalendarProps = CalendarSingleProps | CalendarRangeProps;

/**
 * A token-skinned month grid. Renders react-day-picker with our class map; all
 * keyboard + ARIA behaviour is inherited. `defaultMonth` follows the selection
 * so the calendar opens on the relevant month.
 */
export function Calendar(props: CalendarProps): React.JSX.Element {
  const {
    disabled,
    numberOfMonths = 1,
    weekStartsOn = 0,
    showOutsideDays = true,
    autoFocus = false,
    captionLayout = 'dropdown',
    startMonth,
    endMonth,
    className,
  } = props;

  // Sensible default range for the month/year dropdowns: a century back through
  // a decade ahead, so the year picker covers historical + future dates.
  const thisYear = new Date().getFullYear();
  const resolvedStart = startMonth ?? new Date(thisYear - 100, 0, 1);
  const resolvedEnd = endMonth ?? new Date(thisYear + 10, 11, 31);

  const shared = {
    classNames: CAL_CLASS_NAMES,
    components: { Chevron: CalChevron },
    disabled,
    numberOfMonths,
    weekStartsOn,
    showOutsideDays,
    autoFocus,
    captionLayout,
    startMonth: resolvedStart,
    endMonth: resolvedEnd,
    className: ['u-cal', className].filter(Boolean).join(' '),
  } as const;

  if (props.mode === 'range') {
    const defaultMonth = props.value?.from ?? undefined;
    return (
      <DayPicker
        {...shared}
        mode="range"
        selected={props.value}
        onSelect={(range) => props.onChange?.(range)}
        defaultMonth={defaultMonth}
      />
    );
  }

  return (
    <DayPicker
      {...shared}
      mode="single"
      selected={props.value}
      onSelect={(date) => props.onChange?.(date)}
      defaultMonth={props.value ?? undefined}
    />
  );
}

/* ── DatePicker ──────────────────────────────────────────────────────────── */

export interface DatePickerBaseProps {
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** date-fns format string. Single defaults to "PP" (e.g. Jun 5, 2026). */
  format?: string;
  /** Days that cannot be selected. */
  disabledDates?: Matcher | Matcher[];
  /** Disable the whole control. */
  disabled?: boolean;
  /** First day of the week (0 = Sunday). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Accessible name for the trigger when there is no surrounding label. */
  'aria-label'?: string;
  id?: string;
  name?: string;
  className?: string;
}

export interface DatePickerSingleProps extends DatePickerBaseProps {
  mode?: 'single';
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

export interface DatePickerRangeProps extends DatePickerBaseProps {
  mode: 'range';
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

export type DatePickerProps = DatePickerSingleProps | DatePickerRangeProps;

function labelFor(props: DatePickerProps, fmt: string): string | null {
  if (props.mode === 'range') {
    const r = props.value;
    if (!r?.from) return null;
    const from = formatDate(r.from, fmt);
    return r.to ? `${from} – ${formatDate(r.to, fmt)}` : from;
  }
  return props.value ? formatDate(props.value, fmt) : null;
}

/**
 * A button-styled field with a calendar icon that opens the `Calendar` in a
 * portal popover. The trigger is a native `<button>` so it is fully keyboard
 * operable; once open, react-day-picker owns arrow-key navigation inside the
 * grid. Selecting a day in single mode closes the popover; range mode stays
 * open until both ends are chosen.
 */
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  function DatePicker(props, ref) {
    const {
      placeholder = 'Select a date',
      format: fmt,
      disabledDates,
      disabled = false,
      weekStartsOn = 0,
      id,
      name,
      className,
      'aria-label': ariaLabel,
    } = props;

    const resolvedFmt = fmt ?? 'PP';
    const anchorRef = React.useRef<HTMLDivElement>(null);
    const [open, setOpen] = React.useState(false);

    const close = React.useCallback(() => {
      setOpen(false);
      anchorRef.current
        ?.querySelector<HTMLButtonElement>('.u-datepicker__trigger')
        ?.focus();
    }, []);

    const label = labelFor(props, resolvedFmt);

    // Mirror the selection into a hidden input so the control posts in forms.
    const hiddenValue =
      props.mode === 'range'
        ? props.value?.from
          ? `${props.value.from.toISOString()}${props.value.to ? `/${props.value.to.toISOString()}` : ''}`
          : ''
        : props.value
          ? props.value.toISOString()
          : '';

    return (
      <>
        <div
          ref={anchorRef}
          className={['u-datepicker', className].filter(Boolean).join(' ')}
        >
          <button
            ref={ref}
            id={id}
            type="button"
            className="u-datepicker__trigger"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={ariaLabel ?? (label ? undefined : placeholder)}
            data-placeholder={label ? undefined : ''}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !open) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            <CalendarIcon size={15} className="u-datepicker__icon" aria-hidden="true" />
            <span className="u-datepicker__value">{label ?? placeholder}</span>
            <ChevronDown size={14} className="u-datepicker__caret" aria-hidden="true" />
          </button>
          {name ? <input type="hidden" name={name} value={hiddenValue} readOnly /> : null}
        </div>

        <StPortalPopover
          anchorRef={anchorRef}
          open={open}
          onClose={close}
          align="start"
          role="dialog"
          ariaLabel="Choose date"
          className="u-datepicker__pop"
        >
          {props.mode === 'range' ? (
            <Calendar
              mode="range"
              value={props.value}
              onChange={props.onChange}
              disabled={disabledDates}
              weekStartsOn={weekStartsOn}
              autoFocus
            />
          ) : (
            <Calendar
              mode="single"
              value={props.value}
              onChange={(date) => {
                props.onChange?.(date);
                if (date) close();
              }}
              disabled={disabledDates}
              weekStartsOn={weekStartsOn}
              autoFocus
            />
          )}
        </StPortalPopover>
      </>
    );
  },
);

export type { DateRange, Matcher } from 'react-day-picker';

export default DatePicker;
