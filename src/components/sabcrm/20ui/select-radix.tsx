'use client';

/**
 * 20ui — Select (compound, Radix-driven).
 *
 * The token-skinned wrapper around `@radix-ui/react-select`. This is the
 * compound, shadcn-shaped Select: a `Select` root plus composable
 * `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectItem` parts, so a
 * call site that already imports the shadcn / Ui20 Select becomes a pure
 * import-path swap (the props + exported names match exactly).
 *
 * It is distinct from the props-based 20ui `Select` in `./select` (which takes
 * an `options` array and renders its own listbox over `StPortalPopover`). Use
 * this one when you want JSX children and Radix's native single-select listbox
 * (roving focus, typeahead, full `role="listbox"` / `role="option"` wiring,
 * Escape + outside-click dismissal, and collision-aware positioning).
 *
 * 20ui supplies the look: a `--st-bg` trigger with a chevron, a surface panel on
 * `--u-elev-3`, the one accent for the highlighted row, a Check indicator on the
 * selected option, and an Emil scale-in that grows from whichever edge Radix
 * anchored to (keyed off `--radix-select-content-transform-origin`, see
 * select-radix.css).
 *
 * Content portals to `<body>` through a wrapper carrying
 * `className="ui20 sabcrm-twenty"`, so the `--st-*` / `--u-*` tokens resolve no
 * matter where in the app the trigger lives.
 *
 *   <Select value={status} onValueChange={setStatus}>
 *     <SelectTrigger aria-label="Status">
 *       <SelectValue placeholder="Pick a status" />
 *     </SelectTrigger>
 *     <SelectContent>
 *       <SelectGroup>
 *         <SelectLabel>Pipeline</SelectLabel>
 *         <SelectItem value="new">New</SelectItem>
 *         <SelectItem value="won">Won</SelectItem>
 *         <SelectSeparator />
 *         <SelectItem value="lost">Lost</SelectItem>
 *       </SelectGroup>
 *     </SelectContent>
 *   </Select>
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import './select-radix.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Root state holder. Controlled via `value`/`onValueChange` or left uncontrolled. */
const Select = SelectPrimitive.Root;

/** Groups related options together (wired with `role="group"`). */
const SelectGroup = SelectPrimitive.Group;

/** Renders the selected option's text inside the trigger; takes a `placeholder`. */
const SelectValue = SelectPrimitive.Value;

/* ------------------------------------------------------------------ Trigger */

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cx('u-select-rdx__trigger', className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="u-select-rdx__chevron" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

/* ------------------------------------------------------------- Scroll buttons */

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(function SelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cx('u-select-rdx__scroll', className)}
      {...props}
    >
      <ChevronUp className="u-select-rdx__scroll-icon" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
});

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(function SelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cx('u-select-rdx__scroll', className)}
      {...props}
    >
      <ChevronDown className="u-select-rdx__scroll-icon" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
});

/* ------------------------------------------------------------------ Content */

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent(
  { className, children, position = 'popper', sideOffset = 6, ...props },
  ref,
) {
  return (
    <SelectPrimitive.Portal>
      {/* The wrapper carries the system classes so tokens resolve in the body
          portal; `display: contents` keeps it out of Radix's positioning. */}
      <div className="ui20 sabcrm-twenty u-select-rdx__portal">
        <SelectPrimitive.Content
          ref={ref}
          position={position}
          sideOffset={position === 'popper' ? sideOffset : undefined}
          className={cx(
            'u-select-rdx',
            position === 'popper' && 'u-select-rdx--popper',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport
            className={cx(
              'u-select-rdx__viewport',
              position === 'popper' && 'u-select-rdx__viewport--popper',
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </div>
    </SelectPrimitive.Portal>
  );
});

/* ----------------------------------------------------- Label / Item / Separator */

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cx('u-select-rdx__label', className)}
      {...props}
    />
  );
});

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cx('u-select-rdx__item', className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="u-select-rdx__indicator" aria-hidden="true">
        <SelectPrimitive.ItemIndicator>
          <Check className="u-select-rdx__indicator-check" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
});

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cx('u-select-rdx__separator', className)}
      {...props}
    />
  );
});

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
