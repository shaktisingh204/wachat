import { Input, SelectField, type SelectOption } from '@/components/sabcrm/20ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ClayInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  sizeVariant?: 'sm' | 'md';
}

/**
 * ClayInput - delegates to the 20ui `Input` primitive.
 *
 * `leading`/`trailing` adornments map onto 20ui's built-in affix slots
 * (`prefix`/`suffix`), so the decorations sit flush inside the same visual
 * bounding box with no hand-rolled wrapper or motion.
 */
export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(
  ({ className, leading, trailing, sizeVariant = 'md', ...props }, ref) => (
    <Input
      ref={ref}
      inputSize={sizeVariant}
      prefix={leading ?? undefined}
      suffix={trailing ?? undefined}
      className={cn(className)}
      {...props}
    />
  ),
);
ClayInput.displayName = 'ClayInput';

export interface ClaySelectProps {
  options: Array<{ value: string; label: string }>;
  sizeVariant?: 'sm' | 'md';
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * ClaySelect - delegates to the 20ui props-based `SelectField`, which renders a
 * fully accessible listbox (roving focus, typeahead, `role="listbox"`) over the
 * shared portal popover. It accepts the same flat `options` list as before; the
 * `value`/`onChange(value)` contract follows the 20ui Select shape.
 */
export const ClaySelect = React.forwardRef<HTMLButtonElement, ClaySelectProps>(
  ({ className, options, sizeVariant = 'md', ...props }, ref) => (
    <SelectField
      ref={ref}
      block
      size={sizeVariant}
      options={options as SelectOption[]}
      className={cn(className)}
      {...props}
    />
  ),
);
ClaySelect.displayName = 'ClaySelect';
