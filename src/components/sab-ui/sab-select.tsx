'use client';

/**
 * SabSelect — dropdown select built on Radix Select.
 *
 * API mirrors Radix exactly. Just re-wrap the primitives with SabUI styling.
 *
 *   <SabSelect value={plan} onValueChange={setPlan}>
 *     <SabSelectTrigger placeholder="Choose a plan" />
 *     <SabSelectContent>
 *       <SabSelectItem value="starter">Starter</SabSelectItem>
 *       <SabSelectItem value="pro">Pro</SabSelectItem>
 *     </SabSelectContent>
 *   </SabSelect>
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SabSelect = SelectPrimitive.Root;
export const SabSelectValue = SelectPrimitive.Value;
export const SabSelectGroup = SelectPrimitive.Group;

export interface SabSelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
}

const TRIGGER_SIZE = {
  sm: 'h-8 px-2.5 text-[12.5px] rounded-[8px]',
  md: 'h-10 px-3 text-[13.5px] rounded-[10px]',
  lg: 'h-11 px-3.5 text-[14.5px] rounded-[12px]',
} as const;

export const SabSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SabSelectTriggerProps
>(({ className, children, placeholder, size = 'md', invalid, style, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'sab-select-trigger group inline-flex w-full items-center justify-between gap-2 border outline-none transition-all',
      'focus:ring-[3px]',
      'data-[placeholder]:text-[hsl(var(--sab-fg-subtle))]',
      'disabled:cursor-not-allowed disabled:opacity-60',
      TRIGGER_SIZE[size],
      className,
    )}
    style={{
      background: 'hsl(var(--sab-surface))',
      borderColor: invalid ? 'hsl(var(--sab-danger))' : 'hsl(var(--sab-border))',
      color: 'hsl(var(--sab-fg))',
      fontFamily: 'var(--sab-font-sans)',
      boxShadow: 'var(--sab-shadow-xs)',
      ['--tw-ring-color' as any]: invalid
        ? 'hsl(var(--sab-danger) / 0.15)'
        : 'hsl(var(--sab-primary) / 0.15)',
      ...style,
    }}
    {...props}
  >
    {children || <SelectPrimitive.Value placeholder={placeholder} />}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform group-data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SabSelectTrigger.displayName = 'SabSelectTrigger';

export const SabSelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SabSelectScrollUpButton.displayName = 'SabSelectScrollUpButton';

export const SabSelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SabSelectScrollDownButton.displayName = 'SabSelectScrollDownButton';

export const SabSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', style, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={4}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-[10px] border',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      style={{
        background: 'hsl(var(--sab-surface))',
        borderColor: 'hsl(var(--sab-border))',
        boxShadow: 'var(--sab-shadow-lg)',
        color: 'hsl(var(--sab-fg))',
        fontFamily: 'var(--sab-font-sans)',
        ...style,
      }}
      {...props}
    >
      <SabSelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SabSelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SabSelectContent.displayName = 'SabSelectContent';

export const SabSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
      className,
    )}
    style={{
      color: 'hsl(var(--sab-fg-subtle))',
      fontFamily: 'var(--sab-font-mono)',
    }}
    {...props}
  />
));
SabSelectLabel.displayName = 'SabSelectLabel';

export const SabSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center gap-2 rounded-[6px] py-2 pl-2 pr-8 text-[13px] outline-none transition-colors',
      'focus:bg-[hsl(var(--sab-primary-soft))] focus:text-[hsl(var(--sab-primary))]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'data-[state=checked]:font-medium',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" style={{ color: 'hsl(var(--sab-primary))' }} strokeWidth={3} />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SabSelectItem.displayName = 'SabSelectItem';

export const SabSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px', className)}
    style={{ background: 'hsl(var(--sab-border))' }}
    {...props}
  />
));
SabSelectSeparator.displayName = 'SabSelectSeparator';
