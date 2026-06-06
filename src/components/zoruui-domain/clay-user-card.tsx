'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/sabcrm/20ui/compat';
import { LuEllipsis } from 'react-icons/lu';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ClayUserCardProps {
  name: string;
  email?: string;
  avatarSrc?: string;
  onMenuClick?: () => void;
  className?: string;
}

/**
 * ClayUserCard — bottom-of-sidebar user row. Avatar + name/email +
 * overflow icon. Built on the shadcn `ZoruAvatar` primitive.
 */
export function ClayUserCard({
  name,
  email,
  avatarSrc,
  onMenuClick,
  className,
}: ClayUserCardProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-2 py-2',
        className,
      )}
    >
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} /> : null}
        <AvatarFallback className="bg-gradient-to-br from-muted to-border text-[12px] font-semibold text-[var(--st-text-secondary)]">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[var(--st-text)] leading-[1.2]">
          {name}
        </div>
        {email ? (
          <div className="truncate text-[11px] text-[var(--st-text-secondary)] leading-[1.25]">
            {email}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="User menu"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] transition-colors"
      >
        <LuEllipsis className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
