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
 * CrmPageHeader — the Clay-styled page header used across every
 * CRM landing page. Icon chip + title/subtitle + trailing actions.
 * Mirrors the ClaySectionHeader look with an added module icon.
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
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-5 w-5 text-accent-foreground" strokeWidth={1.75} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
