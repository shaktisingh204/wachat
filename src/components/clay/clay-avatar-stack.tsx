import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface ClayAvatarStackItem {
  src?: string;
  alt?: string;
  fallback?: string;
  hue?: number;
}

export interface ClayAvatarStackProps
  extends React.HTMLAttributes<HTMLDivElement> {
  items: ClayAvatarStackItem[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  overflowTone?: 'rose' | 'obsidian' | 'neutral';
}

const sizeClass: Record<NonNullable<ClayAvatarStackProps['size']>, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-10 w-10 text-[12px]',
};

const overflowSize: Record<NonNullable<ClayAvatarStackProps['size']>, string> = {
  sm: 'h-6 min-w-[28px] px-1.5 text-[10px]',
  md: 'h-[26px] min-w-[34px] px-2 text-[11px]',
  lg: 'h-8 min-w-[40px] px-2.5 text-[12px]',
};

const overflowClass: Record<
  NonNullable<ClayAvatarStackProps['overflowTone']>,
  string
> = {
  rose: 'bg-primary text-primary-foreground',
  obsidian: 'bg-foreground text-background',
  neutral: 'bg-muted text-muted-foreground',
};

/**
 * ClayAvatarStack — overlapped avatars with a trailing "+N" chip.
 * Now delegates to shadcn Avatar primitives wrapped in a flex container.
 */
export function ClayAvatarStack({
  items,
  max = 4,
  size = 'md',
  overflowTone = 'rose',
  className,
  ...props
}: ClayAvatarStackProps) {
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <div
      className={cn('flex items-center -space-x-2', className)}
      {...props}
    >
      {visible.map((item, i) => {
        const fallbackText =
          item.fallback ?? item.alt?.[0]?.toUpperCase() ?? '?';
        return (
          <Avatar
            key={i}
            title={item.alt}
            className={cn(
              'ring-2 ring-background font-medium',
              sizeClass[size],
            )}
            style={
              item.hue !== undefined
                ? {
                    background: `hsl(${item.hue} 60% 88%)`,
                    color: `hsl(${item.hue} 50% 30%)`,
                  }
                : undefined
            }
          >
            {item.src ? (
              <AvatarImage src={item.src} alt={item.alt || ''} />
            ) : null}
            <AvatarFallback
              className="bg-transparent text-inherit"
              style={
                item.hue !== undefined
                  ? {
                      background: `hsl(${item.hue} 60% 88%)`,
                      color: `hsl(${item.hue} 50% 30%)`,
                    }
                  : undefined
              }
            >
              {fallbackText}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 ? (
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-full font-semibold ring-2 ring-background',
            overflowSize[size],
            overflowClass[overflowTone],
          )}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
