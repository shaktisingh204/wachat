import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ClayInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  sizeVariant?: 'sm' | 'md';
}

/**
 * ClayInput — delegates to the shadcn `Input` primitive.
 * When `leading`/`trailing` adornments are provided, we wrap the
 * primitive in a flex container with focus-within styling so the
 * decorations sit flush inside the same visual bounding box.
 */
export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(
  ({ className, leading, trailing, sizeVariant = 'md', ...props }, ref) => {
    if (!leading && !trailing) {
      return (
        <Input
          ref={ref}
          className={cn(
            sizeVariant === 'sm' && 'h-8 py-1.5 text-[12.5px]',
            sizeVariant === 'md' && 'h-10',
            className,
          )}
          {...props}
        />
      );
    }
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-background ring-offset-background transition-all duration-150',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          'hover:border-[hsl(var(--prism-indigo)/0.4)] focus-within:border-[hsl(var(--prism-indigo)/0.5)]',
          sizeVariant === 'sm' ? 'h-8 px-2.5' : 'h-10 px-3',
          className,
        )}
      >
        {leading ? (
          <span className="flex shrink-0 items-center text-muted-foreground">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        {trailing ? (
          <span className="flex shrink-0 items-center text-muted-foreground">
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);
ClayInput.displayName = 'ClayInput';

export interface ClaySelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  sizeVariant?: 'sm' | 'md';
}

/**
 * ClaySelect — native <select> styled to match the shadcn Input.
 * (We deliberately keep this as a native element rather than the
 * Radix-based shadcn Select primitive because the public API here
 * accepts standard select HTML attributes plus a flat `options` list.)
 */
export const ClaySelect = React.forwardRef<HTMLSelectElement, ClaySelectProps>(
  ({ className, options, sizeVariant = 'md', ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-all duration-150 placeholder:text-muted-foreground hover:border-[hsl(var(--prism-indigo)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-[hsl(var(--prism-indigo)/0.5)] disabled:cursor-not-allowed disabled:opacity-50',
        'appearance-none bg-no-repeat pr-8',
        sizeVariant === 'sm' && 'h-8 py-1 text-[12.5px]',
        sizeVariant === 'md' && 'h-10',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2395918B'%3e%3cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3e%3c/svg%3e\")",
        backgroundPosition: 'right 0.625rem center',
        backgroundSize: '1rem',
      }}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
);
ClaySelect.displayName = 'ClaySelect';
