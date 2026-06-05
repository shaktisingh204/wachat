'use client';

/**
 * 20ui — Command palette.
 *
 * A cmd-k command menu built on `cmdk`, skinned with the 20ui token set. The
 * primitives (`Command`, `CommandInput`, `CommandList`, `CommandEmpty`,
 * `CommandGroup`, `CommandItem`, `CommandSeparator`) wrap their cmdk equivalents
 * and add the `u-cmd*` classes; cmdk owns the heavy lifting (fuzzy filtering,
 * roving focus, ArrowUp/Down + Home/End navigation, type-ahead, the
 * `aria-selected` active row, `role="option"` / `role="listbox"`).
 *
 * `CommandDialog` lifts the palette into a centred overlay. It portals into a
 * `ui20 sabcrm-twenty` root (so the `--st-*` / `--u-*` tokens resolve app-wide,
 * not just inside the CRM), focuses the search input on open, closes on Escape
 * or an overlay click, and locks body scroll while open. `CommandShortcut`
 * renders the right-aligned keyboard hint using the shared 20ui Kbd look.
 *
 * Emil motion: the overlay fades, the panel scale-ins from centre
 * (transform/opacity only, < 250ms); reduced motion collapses to a fade
 * (handled in command.css).
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

import './command.css';

/* The dialog publishes its input ref here so a child `CommandInput` can pick it
   up and be focused on open, without the caller threading a ref through. */
const CommandInputContext =
  React.createContext<React.RefObject<HTMLInputElement | null> | null>(null);

/* ------------------------------------------------------------------ Root --- */

export type CommandProps = React.ComponentPropsWithoutRef<typeof CommandPrimitive>;

/**
 * The command root. Owns search state, filtering, and keyboard navigation.
 *
 *   <Command label="Global commands">
 *     <CommandInput placeholder="Search commands..." />
 *     <CommandList>
 *       <CommandEmpty>No results found.</CommandEmpty>
 *       <CommandGroup heading="Records">
 *         <CommandItem onSelect={openLeads}>
 *           Go to Leads
 *           <CommandShortcut>G L</CommandShortcut>
 *         </CommandItem>
 *       </CommandGroup>
 *     </CommandList>
 *   </Command>
 */
export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  CommandProps
>(function Command({ className, ...rest }, ref) {
  return (
    <CommandPrimitive
      ref={ref}
      className={['u-cmd', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/* ----------------------------------------------------------------- Input --- */

export type CommandInputProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Input
>;

/** The search row: a leading magnifier and the cmdk input. */
const BaseCommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  CommandInputProps
>(function CommandInput({ className, ...rest }, ref) {
  return (
    <div className="u-cmd__input-row" cmdk-input-wrapper="">
      <Search className="u-cmd__input-icon" size={16} aria-hidden="true" />
      <CommandPrimitive.Input
        ref={ref}
        className={['u-cmd__input', className].filter(Boolean).join(' ')}
        {...rest}
      />
    </div>
  );
});

/**
 * The search input. When rendered inside a `CommandDialog` it transparently
 * receives the dialog's input ref (via context) so the palette can focus it on
 * open; outside a dialog it behaves like any forwardRef input.
 */
export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  CommandInputProps
>(function CommandInput(props, ref) {
  const bridged = React.useContext(CommandInputContext);
  return <BaseCommandInput ref={ref ?? bridged ?? undefined} {...props} />;
});

/* ------------------------------------------------------------------ List --- */

export type CommandListProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.List
>;

/** The scrollable region holding groups and items. */
export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  CommandListProps
>(function CommandList({ className, ...rest }, ref) {
  return (
    <CommandPrimitive.List
      ref={ref}
      className={['u-cmd__list', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/* ----------------------------------------------------------------- Empty --- */

export type CommandEmptyProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Empty
>;

/** Auto-rendered when the query matches nothing. */
export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  CommandEmptyProps
>(function CommandEmpty({ className, ...rest }, ref) {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      className={['u-cmd__empty', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/* ----------------------------------------------------------------- Group --- */

export type CommandGroupProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Group
>;

/** A titled cluster of items. The heading reads as an uppercase section label. */
export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  CommandGroupProps
>(function CommandGroup({ className, ...rest }, ref) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      className={['u-cmd__group', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/* ------------------------------------------------------------- Separator --- */

export type CommandSeparatorProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Separator
>;

/** A hairline divider between groups. */
export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  CommandSeparatorProps
>(function CommandSeparator({ className, ...rest }, ref) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      className={['u-cmd__sep', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/* ------------------------------------------------------------------ Item --- */

export type CommandItemProps = React.ComponentPropsWithoutRef<
  typeof CommandPrimitive.Item
>;

/**
 * A selectable row. cmdk highlights the active row via `aria-selected` (styled
 * in command.css) and fires `onSelect` on Enter / click. Trailing children
 * (e.g. a `CommandShortcut`) align to the right.
 */
export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  CommandItemProps
>(function CommandItem({ className, ...rest }, ref) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={['u-cmd__item', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
});

/* -------------------------------------------------------------- Shortcut --- */

export type CommandShortcutProps = React.HTMLAttributes<HTMLSpanElement>;

/**
 * Right-aligned keyboard hint inside an item, styled like the 20ui Kbd. Pass
 * the chord as text, e.g. `<CommandShortcut>Ctrl K</CommandShortcut>`.
 */
export function CommandShortcut({
  className,
  ...rest
}: CommandShortcutProps): React.JSX.Element {
  return (
    <span
      className={['u-cmd__shortcut', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      {...rest}
    />
  );
}

/* ---------------------------------------------------------------- Dialog --- */

export interface CommandDialogProps extends CommandProps {
  /** Whether the palette is mounted + visible. */
  open: boolean;
  /** Called on Escape, overlay click, or a programmatic close request. */
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the dialog (also cmdk's hidden label). */
  label?: string;
}

/**
 * The cmd-k palette: a centred overlay containing a `Command`. Renders into a
 * portal root that carries `ui20 sabcrm-twenty` so the tokens resolve anywhere
 * in the app. Escape / overlay-click close; the search input is focused on open.
 */
export function CommandDialog({
  open,
  onOpenChange,
  label = 'Command palette',
  className,
  children,
  ...rest
}: CommandDialogProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Portal target only exists on the client.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Focus the search input once the panel has painted.
  React.useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Lock body scroll while open (compensate for the scrollbar to avoid a shift).
  React.useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const overlay = (
    <div
      className="ui20 sabcrm-twenty u-cmd-overlay"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={['u-cmd-dialog', className].filter(Boolean).join(' ')}
        // Pointer-downs inside the panel must not reach the overlay dismiss
        // handler (so a drag-select that ends outside does not close it).
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Command
          label={label}
          loop
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
          {...rest}
        >
          {/* Bridge the dialog's input ref into CommandInput so we can focus it. */}
          <CommandInputContext.Provider value={inputRef}>
            {children}
          </CommandInputContext.Provider>
        </Command>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export default Command;
