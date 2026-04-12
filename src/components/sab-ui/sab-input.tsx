'use client';

/**
 * SabInput — the standard text input for SabUI.
 *
 * Features:
 *   - Three sizes (sm / md / lg)
 *   - Left + right icon slots (pass a Lucide component or any ReactNode)
 *   - Prefix / suffix inline labels (e.g. "https://" or ".com" or "$")
 *   - Invalid state with red border and ring
 *   - Focus ring uses the SabUI primary colour
 *   - Styled via CSS vars, not Tailwind theme — retheming is one globals.css edit
 *
 * Use inside a SabField for the label + help + error pattern:
 *
 *   <SabField label="Email" required>
 *     <SabInput type="email" leftIcon={Mail} placeholder="you@acme.com" />
 *   </SabField>
 */

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SabInputSize = 'sm' | 'md' | 'lg';

export interface SabInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  inputSize?: SabInputSize;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  /** Short text rendered inside the input, left of the value. */
  prefix?: React.ReactNode;
  /** Short text rendered inside the input, right of the value. */
  suffix?: React.ReactNode;
  invalid?: boolean;
  /** Wrapper className — use for flex grow behaviour in toolbars. */
  containerClassName?: string;
}

const SIZE: Record<SabInputSize, { h: string; px: string; text: string; radius: string; icon: string }> = {
  sm: { h: 'h-8', px: 'px-2.5', text: 'text-[12.5px]', radius: 'rounded-[8px]', icon: 'h-3.5 w-3.5' },
  md: { h: 'h-10', px: 'px-3', text: 'text-[13.5px]', radius: 'rounded-[10px]', icon: 'h-4 w-4' },
  lg: { h: 'h-11', px: 'px-3.5', text: 'text-[14.5px]', radius: 'rounded-[12px]', icon: 'h-[18px] w-[18px]' },
};

export const SabInput = React.forwardRef<HTMLInputElement, SabInputProps>(
  (
    {
      className,
      containerClassName,
      inputSize = 'md',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      prefix,
      suffix,
      invalid,
      disabled,
      style,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const s = SIZE[inputSize];
    const [focused, setFocused] = React.useState(false);

    const wrapperStyle: React.CSSProperties = {
      background: disabled ? 'hsl(var(--sab-bg-subtle))' : 'hsl(var(--sab-surface))',
      border: `1px solid ${
        invalid
          ? 'hsl(var(--sab-danger))'
          : focused
            ? 'hsl(var(--sab-primary))'
            : 'hsl(var(--sab-border))'
      }`,
      boxShadow: focused
        ? invalid
          ? '0 0 0 3px hsl(var(--sab-danger) / 0.15)'
          : '0 0 0 3px hsl(var(--sab-primary) / 0.15)'
        : 'var(--sab-shadow-xs)',
      color: 'hsl(var(--sab-fg))',
      transition: 'box-shadow 150ms ease, border-color 150ms ease',
      opacity: disabled ? 0.6 : 1,
      ...style,
    };

    return (
      <div
        className={cn(
          'sab-input-wrapper flex w-full items-center gap-2',
          s.h,
          s.px,
          s.radius,
          disabled && 'cursor-not-allowed',
          containerClassName,
        )}
        style={wrapperStyle}
      >
        {LeftIcon ? (
          <LeftIcon className={cn(s.icon, 'shrink-0')} style={{ color: 'hsl(var(--sab-fg-subtle))' }} />
        ) : null}
        {prefix ? (
          <span
            className="shrink-0 text-[12px]"
            style={{ color: 'hsl(var(--sab-fg-subtle))', fontFamily: 'var(--sab-font-mono)' }}
          >
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'peer flex-1 bg-transparent outline-none placeholder:text-[hsl(var(--sab-fg-subtle))] disabled:cursor-not-allowed',
            s.text,
            className,
          )}
          style={{ fontFamily: 'var(--sab-font-sans)', color: 'inherit' }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {suffix ? (
          <span
            className="shrink-0 text-[12px]"
            style={{ color: 'hsl(var(--sab-fg-subtle))', fontFamily: 'var(--sab-font-mono)' }}
          >
            {suffix}
          </span>
        ) : null}
        {RightIcon ? (
          <RightIcon className={cn(s.icon, 'shrink-0')} style={{ color: 'hsl(var(--sab-fg-subtle))' }} />
        ) : null}
      </div>
    );
  },
);
SabInput.displayName = 'SabInput';
