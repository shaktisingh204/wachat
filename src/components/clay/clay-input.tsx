import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClayInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  sizeVariant?: 'sm' | 'md';
}

export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(
  ({ className, leading, trailing, sizeVariant = 'md', ...props }, ref) => {
    if (!leading && !trailing) {
      return (
        <input
          ref={ref}
          className={cn(
            'clay-input',
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
          'flex items-center gap-2 rounded-clay-md border border-clay-border bg-clay-surface transition-[border-color,box-shadow] focus-within:border-clay-rose focus-within:ring-[3px] focus-within:ring-clay-rose/15',
          sizeVariant === 'sm' ? 'h-8 px-2.5' : 'h-10 px-3',
          className,
        )}
      >
        {leading ? (
          <span className="flex shrink-0 items-center text-clay-ink-soft">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          className="flex-1 bg-transparent text-[13px] text-clay-ink placeholder:text-clay-ink-soft focus:outline-none"
          {...props}
        />
        {trailing ? (
          <span className="flex shrink-0 items-center text-clay-ink-soft">
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

export const ClaySelect = React.forwardRef<HTMLSelectElement, ClaySelectProps>(
  ({ className, options, sizeVariant = 'md', ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'clay-input appearance-none bg-no-repeat pr-8',
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
