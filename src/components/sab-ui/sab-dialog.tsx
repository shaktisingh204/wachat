'use client';

/**
 * SabDialog — the canonical dialog / modal for SabUI.
 *
 * Built on top of Radix Dialog (already shipping with the app) so we inherit
 * focus trapping, ESC to close, backdrop click, portal mounting, and all the
 * accessibility work for free.
 *
 *   <SabDialog open={open} onOpenChange={setOpen}>
 *     <SabDialogTrigger asChild>
 *       <SabButton>Open</SabButton>
 *     </SabDialogTrigger>
 *     <SabDialogContent>
 *       <SabDialogHeader
 *         title="Invite teammate"
 *         description="They'll receive an email with a magic link."
 *       />
 *       <SabDialogBody>
 *         <SabField label="Email">
 *           <SabInput type="email" />
 *         </SabField>
 *       </SabDialogBody>
 *       <SabDialogFooter>
 *         <SabButton variant="ghost" onClick={() => setOpen(false)}>Cancel</SabButton>
 *         <SabButton variant="primary">Send invite</SabButton>
 *       </SabDialogFooter>
 *     </SabDialogContent>
 *   </SabDialog>
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SabDialog = DialogPrimitive.Root;
export const SabDialogTrigger = DialogPrimitive.Trigger;
export const SabDialogPortal = DialogPrimitive.Portal;
export const SabDialogClose = DialogPrimitive.Close;

/* -------------------------------------------------------------------------- */
/*  Overlay                                                                    */
/* -------------------------------------------------------------------------- */

export const SabDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'sab-dialog-overlay fixed inset-0 z-50',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
      className,
    )}
    style={{
      background: 'rgba(15, 14, 17, 0.45)',
      backdropFilter: 'blur(4px)',
    }}
    {...props}
  />
));
SabDialogOverlay.displayName = 'SabDialogOverlay';

/* -------------------------------------------------------------------------- */
/*  Content                                                                    */
/* -------------------------------------------------------------------------- */

export type SabDialogSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<SabDialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export interface SabDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: SabDialogSize;
  /** Hide the top-right close button (e.g. for force-respond dialogs). */
  hideCloseButton?: boolean;
}

export const SabDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SabDialogContentProps
>(({ className, children, size = 'md', hideCloseButton, style, ...props }, ref) => (
  <SabDialogPortal>
    <SabDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'sab-dialog-content fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]',
        SIZE_CLASS[size],
        className,
      )}
      style={{
        background: 'hsl(var(--sab-surface))',
        borderColor: 'hsl(var(--sab-border))',
        borderRadius: 'var(--sab-radius-xl)',
        color: 'hsl(var(--sab-fg))',
        fontFamily: 'var(--sab-font-sans)',
        boxShadow: 'var(--sab-shadow-xl)',
        maxHeight: 'calc(100vh - 4rem)',
        ...style,
      }}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            'absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors',
            'focus-visible:outline-none focus-visible:ring-[3px]',
            'disabled:pointer-events-none',
          )}
          style={{
            color: 'hsl(var(--sab-fg-muted))',
            ['--tw-ring-color' as any]: 'hsl(var(--sab-primary) / 0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'hsl(var(--sab-bg-subtle))';
            e.currentTarget.style.color = 'hsl(var(--sab-fg))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'hsl(var(--sab-fg-muted))';
          }}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SabDialogPortal>
));
SabDialogContent.displayName = 'SabDialogContent';

/* -------------------------------------------------------------------------- */
/*  Header / Body / Footer                                                     */
/* -------------------------------------------------------------------------- */

export interface SabDialogHeaderProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function SabDialogHeader({
  title,
  description,
  icon,
  className,
  children,
}: SabDialogHeaderProps) {
  return (
    <div
      className={cn('flex items-start gap-3 px-6 pb-5 pt-6', className)}
      style={{ borderBottom: '1px solid hsl(var(--sab-border))' }}
    >
      {icon ? (
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: 'hsl(var(--sab-primary-soft))',
            color: 'hsl(var(--sab-primary))',
          }}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8">
        {title ? (
          <DialogPrimitive.Title
            className="text-[16px] font-semibold leading-tight"
            style={{ color: 'hsl(var(--sab-fg))' }}
          >
            {title}
          </DialogPrimitive.Title>
        ) : null}
        {description ? (
          <DialogPrimitive.Description
            className="text-[13px] leading-relaxed"
            style={{ color: 'hsl(var(--sab-fg-muted))' }}
          >
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export const SabDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1 overflow-y-auto px-6 py-5', className)}
    {...props}
  />
));
SabDialogBody.displayName = 'SabDialogBody';

export const SabDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-end gap-2 px-6 py-4',
      className,
    )}
    style={{
      borderTop: '1px solid hsl(var(--sab-border))',
      background: 'hsl(var(--sab-bg-subtle))',
    }}
    {...props}
  />
));
SabDialogFooter.displayName = 'SabDialogFooter';
