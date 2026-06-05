'use client';

/**
 * 20ui — Disclosure (Accordion + Collapsible).
 *
 * Thin, tokenised wrappers over Radix's accordion + collapsible primitives. They
 * keep Radix's full keyboard + ARIA model (Arrow up/down between triggers,
 * Home/End to the ends, Space/Enter toggle; `region` content, `aria-expanded`,
 * `aria-controls`) and add the 20ui look: a hairline-stacked list, a chevron that
 * rotates on open, and a smooth height animation driven by Radix's
 * `--radix-*-content-height` var. Reduced motion drops the height + rotate.
 *
 *   <Accordion type="single" collapsible defaultValue="billing">
 *     <AccordionItem value="billing">
 *       <AccordionTrigger>Billing</AccordionTrigger>
 *       <AccordionContent>Manage cards, invoices and plan.</AccordionContent>
 *     </AccordionItem>
 *   </Accordion>
 *
 *   <Collapsible>
 *     <CollapsibleTrigger>Advanced settings</CollapsibleTrigger>
 *     <CollapsibleContent>Hidden until toggled.</CollapsibleContent>
 *   </Collapsible>
 */

import * as React from 'react';
import * as RadixAccordion from '@radix-ui/react-accordion';
import * as RadixCollapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';

import './disclosure.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/* ============================================================ Accordion === */

export type AccordionProps =
  | (RadixAccordion.AccordionSingleProps & { ref?: React.Ref<HTMLDivElement> })
  | (RadixAccordion.AccordionMultipleProps & { ref?: React.Ref<HTMLDivElement> });

/**
 * A vertical stack of collapsible sections. `type="single"` keeps one section
 * open at a time (add `collapsible` to allow closing the open one);
 * `type="multiple"` lets sections open independently.
 */
export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  function Accordion({ className, ...rest }, ref) {
    return (
      <RadixAccordion.Root
        ref={ref}
        className={cx('u-accordion', className)}
        // Spread carries the discriminated single/multiple props through intact.
        {...(rest as AccordionProps)}
      />
    );
  },
) as React.ForwardRefExoticComponent<AccordionProps>;

export interface AccordionItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixAccordion.Item> {}

/** One section of an `Accordion`. Needs a unique `value`. */
export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  function AccordionItem({ className, ...rest }, ref) {
    return (
      <RadixAccordion.Item ref={ref} className={cx('u-accordion__item', className)} {...rest} />
    );
  },
);

export interface AccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixAccordion.Trigger> {
  /** Hide the rotating chevron (e.g. when you render your own affordance). */
  hideChevron?: boolean;
}

/**
 * The always-visible header that toggles its section. Rendered inside an
 * `AccordionHeader` (`h3`) so the section is a proper heading for AT.
 */
export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  function AccordionTrigger({ className, children, hideChevron = false, ...rest }, ref) {
    return (
      <RadixAccordion.Header className="u-accordion__header">
        <RadixAccordion.Trigger
          ref={ref}
          className={cx('u-accordion__trigger', className)}
          {...rest}
        >
          <span className="u-accordion__trigger-label">{children}</span>
          {hideChevron ? null : (
            <ChevronDown size={16} className="u-accordion__chevron" aria-hidden="true" />
          )}
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
    );
  },
);

export interface AccordionContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixAccordion.Content> {}

/** The collapsible body of a section. Height-animates open/closed. */
export const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  function AccordionContent({ className, children, ...rest }, ref) {
    return (
      <RadixAccordion.Content
        ref={ref}
        className={cx('u-accordion__content', className)}
        {...rest}
      >
        {/* Inner padding lives on a child so the animated wrapper can clamp to
            height: 0 cleanly without padding leaking through. */}
        <div className="u-accordion__content-inner">{children}</div>
      </RadixAccordion.Content>
    );
  },
);

/* ========================================================== Collapsible === */

export interface CollapsibleProps
  extends React.ComponentPropsWithoutRef<typeof RadixCollapsible.Root> {}

/** A single show/hide region — no item grouping, just one trigger + body. */
export const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  function Collapsible({ className, ...rest }, ref) {
    return (
      <RadixCollapsible.Root ref={ref} className={cx('u-collapsible', className)} {...rest} />
    );
  },
);

export interface CollapsibleTriggerProps
  extends React.ComponentPropsWithoutRef<typeof RadixCollapsible.Trigger> {
  /** Hide the rotating chevron. */
  hideChevron?: boolean;
}

/** Toggles the `Collapsible`. Carries `aria-expanded` + `aria-controls` for free. */
export const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  function CollapsibleTrigger({ className, children, hideChevron = false, ...rest }, ref) {
    return (
      <RadixCollapsible.Trigger
        ref={ref}
        className={cx('u-collapsible__trigger', className)}
        {...rest}
      >
        <span className="u-collapsible__trigger-label">{children}</span>
        {hideChevron ? null : (
          <ChevronDown size={16} className="u-collapsible__chevron" aria-hidden="true" />
        )}
      </RadixCollapsible.Trigger>
    );
  },
);

export interface CollapsibleContentProps
  extends React.ComponentPropsWithoutRef<typeof RadixCollapsible.Content> {}

/** The body revealed by a `CollapsibleTrigger`. Height-animates open/closed. */
export const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  function CollapsibleContent({ className, children, ...rest }, ref) {
    return (
      <RadixCollapsible.Content
        ref={ref}
        className={cx('u-collapsible__content', className)}
        {...rest}
      >
        <div className="u-collapsible__content-inner">{children}</div>
      </RadixCollapsible.Content>
    );
  },
);

export default Accordion;
