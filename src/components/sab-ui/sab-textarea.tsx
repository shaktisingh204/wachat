'use client';

/**
 * SabTextarea — multiline input with the same visual language as SabInput.
 *
 * Features:
 *   - Optional auto-resize based on content
 *   - Monospace variant for code / template body editing
 *   - Character counter slot (via containerAside)
 *   - Invalid + disabled states
 *
 * NOTE: this is a plain textarea, not a rich-text editor. If you need
 * formatting (bold, italic, links, mentions), a dedicated rich-text
 * editor is a separate follow-up (TipTap or Slate).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SabTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  invalid?: boolean;
  /** Make the textarea grow as the user types. */
  autoResize?: boolean;
  /** Use the SabUI mono font — good for code / templates. */
  monospace?: boolean;
  /** Min rows when empty (defaults to 3). */
  minRows?: number;
  /** Max rows before the box starts scrolling instead of growing (auto-resize only). */
  maxRows?: number;
  containerClassName?: string;
}

export const SabTextarea = React.forwardRef<HTMLTextAreaElement, SabTextareaProps>(
  (
    {
      className,
      containerClassName,
      invalid,
      autoResize,
      monospace,
      minRows = 3,
      maxRows,
      disabled,
      style,
      onFocus,
      onBlur,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const [focused, setFocused] = React.useState(false);

    // Auto-resize logic — recompute height on every value change.
    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoResize) return;
      el.style.height = 'auto';
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '20');
      const maxHeight = maxRows ? lineHeight * maxRows + 20 : Infinity;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [autoResize, maxRows]);

    React.useEffect(() => {
      resize();
    }, [resize, value, defaultValue]);

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
      transition: 'box-shadow 150ms ease, border-color 150ms ease',
      opacity: disabled ? 0.6 : 1,
      ...style,
    };

    return (
      <div
        className={cn('rounded-[10px] px-3 py-2.5', containerClassName)}
        style={wrapperStyle}
      >
        <textarea
          ref={innerRef}
          disabled={disabled}
          rows={minRows}
          value={value}
          defaultValue={defaultValue}
          className={cn(
            'w-full resize-none bg-transparent text-[13.5px] leading-relaxed outline-none placeholder:text-[hsl(var(--sab-fg-subtle))] disabled:cursor-not-allowed',
            className,
          )}
          style={{
            color: 'hsl(var(--sab-fg))',
            fontFamily: monospace ? 'var(--sab-font-mono)' : 'var(--sab-font-sans)',
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          onChange={(e) => {
            onChange?.(e);
            if (autoResize) {
              // Next paint so the new content is measured.
              requestAnimationFrame(resize);
            }
          }}
          {...props}
        />
      </div>
    );
  },
);
SabTextarea.displayName = 'SabTextarea';
