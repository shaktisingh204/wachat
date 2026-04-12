'use client';

/**
 * SabField — the canonical "label + control + help/error" wrapper.
 *
 * Use this for every form field in SabUI so spacing and typography stay
 * consistent app-wide. The control is rendered as children so you can
 * compose any input type (SabInput, SabSelect, SabTextarea, etc.).
 *
 *   <SabField
 *     label="Display name"
 *     help="This is what customers will see."
 *     required
 *   >
 *     <SabInput placeholder="Acme Inc." />
 *   </SabField>
 */

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SabLabel } from './sab-label';

export interface SabFieldProps {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  /** Optional extra content rendered on the right side of the label row (e.g. a "max 140 chars" hint) */
  labelAside?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function SabField({
  label,
  help,
  error,
  required,
  optional,
  labelAside,
  htmlFor,
  className,
  children,
}: SabFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || labelAside) && (
        <div className="flex items-baseline justify-between gap-2">
          {label ? (
            <SabLabel htmlFor={htmlFor} required={required} optional={optional}>
              {label}
            </SabLabel>
          ) : (
            <span />
          )}
          {labelAside ? (
            <span
              className="text-[11px] tabular-nums"
              style={{
                color: 'hsl(var(--sab-fg-subtle))',
                fontFamily: 'var(--sab-font-mono)',
              }}
            >
              {labelAside}
            </span>
          ) : null}
        </div>
      )}
      {children}
      {error ? (
        <p
          className="inline-flex items-center gap-1 text-[12px]"
          style={{ color: 'hsl(var(--sab-danger))' }}
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : help ? (
        <p
          className="text-[12px] leading-snug"
          style={{ color: 'hsl(var(--sab-fg-muted))' }}
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}
