'use client';

/**
 * 20ui — Label. A standalone form label (Radix Label) for cases where a control
 * is not wrapped in <Field>. Token-styled; matches the Ui20 Label API
 * (ComponentPropsWithoutRef<LabelPrimitive.Root> + `required`) so it is a
 * drop-in replacement.
 */

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import './label.css';

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Append a danger-coloured asterisk to mark the field as required. */
  required?: boolean;
}

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(function Label({ className, required, children, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={['u-label', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
      {required ? (
        <span className="u-label__req" aria-hidden="true">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
});
