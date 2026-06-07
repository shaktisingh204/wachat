'use client';

import { Avatar, AvatarFallback, AvatarImage, IconButton } from '@/components/sabcrm/20ui';
import { MoreHorizontal } from 'lucide-react';

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
 * ClayUserCard. Bottom-of-sidebar user row: avatar plus name/email plus an
 * overflow menu button. Built on the 20ui Avatar and IconButton primitives.
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
    <div className={cn('flex items-center gap-3 px-2 py-2', className)}>
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-[var(--st-bg)]">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} /> : null}
        <AvatarFallback className="bg-[var(--st-bg-secondary)] text-[12px] font-semibold text-[var(--st-text-secondary)]">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-[1.2] text-[var(--st-text)]">
          {name}
        </div>
        {email ? (
          <div className="truncate text-[11px] leading-[1.25] text-[var(--st-text-secondary)]">
            {email}
          </div>
        ) : null}
      </div>
      <IconButton
        label="User menu"
        icon={MoreHorizontal}
        variant="ghost"
        size="sm"
        onClick={onMenuClick}
        className="shrink-0"
      />
    </div>
  );
}
