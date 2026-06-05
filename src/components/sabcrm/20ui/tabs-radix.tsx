'use client';

/**
 * 20ui — Tabs.
 *
 * A token-skinned wrapper around `@radix-ui/react-tabs`. Radix supplies the
 * accessible foundation (`role="tablist"` / `tab` / `tabpanel`, roving focus
 * with arrow keys, automatic/manual activation, `aria-selected`, and the
 * tab/panel `aria-controls` + `aria-labelledby` wiring). 20ui supplies the
 * look: a quiet `TabsList` rail, a muted-to-ink trigger ramp, and an active
 * underline indicator that slides between triggers via a smooth CSS transition
 * on the shared underline track.
 *
 * The active indicator is drawn purely in CSS (an underline that grows under
 * the `[data-state=active]` trigger and transitions on transform + opacity),
 * so there is no JS animation library and no layout observer. Pass `noPill` to
 * a trigger to render the bare active state without the underline (kept for
 * call-site API parity with the ZoruUI Tabs it replaces).
 *
 *   <Tabs defaultValue="overview">
 *     <TabsList>
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="activity">Activity</TabsTrigger>
 *       <TabsTrigger value="files">Files</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">…</TabsContent>
 *     <TabsContent value="activity">…</TabsContent>
 *     <TabsContent value="files">…</TabsContent>
 *   </Tabs>
 */

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import './tabs-radix.css';

const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Root state holder. Controlled via `value`/`onValueChange` or `defaultValue`. */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(function Tabs({ className, ...props }, ref) {
  return <TabsPrimitive.Root ref={ref} className={cx('u-tabs', className)} {...props} />;
});
Tabs.displayName = 'Tabs';

/** The rail holding the triggers. Renders `role="tablist"`. */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return <TabsPrimitive.List ref={ref} className={cx('u-tabs__list', className)} {...props} />;
});
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Render the bare active state without the sliding underline indicator. */
  noPill?: boolean;
}

/**
 * A single tab. The active one (`data-state="active"`) gets the ink text colour
 * and an underline indicator; the underline transitions smoothly on transform +
 * opacity. Focus-visible paints the 20ui focus ring.
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(function TabsTrigger({ className, children, noPill, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cx('u-tabs__trigger', noPill && 'u-tabs__trigger--no-pill', className)}
      {...props}
    >
      <span className="u-tabs__trigger-label">{children}</span>
      {!noPill ? <span className="u-tabs__indicator" aria-hidden="true" /> : null}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * The panel for a tab. Hidden until its `value` matches. Focus-visible paints
 * the 20ui focus ring so keyboard users can see the panel has focus.
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content ref={ref} className={cx('u-tabs__content', className)} {...props} />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
