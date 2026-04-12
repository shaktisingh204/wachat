import * as React from 'react';
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

const sizeClass = {
  sm: 'h-6 w-6 text-[10px] -ml-2 first:ml-0',
  md: 'h-8 w-8 text-[11px] -ml-2.5 first:ml-0',
  lg: 'h-10 w-10 text-[12px] -ml-3 first:ml-0',
};

/**
 * Overflow chip — in the reference this is NOT a circle. It's a wider
 * rose-colored oval/pill sitting slightly nested into the last avatar.
 * Dimensions are tuned to match the reference where the "+5" reads as
 * a ~32×22 pill, not a round badge.
 */
const overflowSize = {
  sm: 'h-6    min-w-[28px] px-1.5 text-[10px] -ml-2',
  md: 'h-[26px] min-w-[34px] px-2 text-[11px] -ml-3',
  lg: 'h-8    min-w-[40px] px-2.5 text-[12px] -ml-3',
};

const overflowClass = {
  rose: 'bg-clay-rose text-white',
  obsidian: 'bg-clay-obsidian text-white',
  neutral: 'bg-clay-bg-2 text-clay-ink-muted',
};

/**
 * ClayAvatarStack — overlapped avatars with a trailing "+N" chip.
 * Mirrors the "10 candidates +5" pattern in the Round cards.
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
    <div className={cn('flex items-center', className)} {...props}>
      {visible.map((item, i) => (
        <div
          key={i}
          title={item.alt}
          className={cn(
            'rounded-full clay-avatar-ring overflow-hidden flex items-center justify-center font-medium bg-clay-bg-2 text-clay-ink-muted',
            sizeClass[size],
          )}
          style={
            item.hue !== undefined
              ? { background: `hsl(${item.hue} 60% 88%)`, color: `hsl(${item.hue} 50% 30%)` }
              : undefined
          }
        >
          {item.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.src}
              alt={item.alt || ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{item.fallback ?? item.alt?.[0]?.toUpperCase() ?? '?'}</span>
          )}
        </div>
      ))}
      {overflow > 0 ? (
        <div
          className={cn(
            'rounded-full clay-avatar-ring inline-flex items-center justify-center font-semibold',
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
