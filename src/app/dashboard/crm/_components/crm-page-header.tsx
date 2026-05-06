import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CrmPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * CrmPageHeader — Zoru-styled page header used across every CRM
 * landing page. Icon chip + title/subtitle + trailing actions.
 */
export function CrmPageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: CrmPageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2">
            <Icon className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight text-zoru-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-zoru-ink-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
