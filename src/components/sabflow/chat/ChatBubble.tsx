'use client';

import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  /** 'bot' = left-aligned host bubble; 'user' = right-aligned guest bubble. */
  variant: 'bot' | 'user';
  children: React.ReactNode;
  /** Override background colour. */
  backgroundColor?: string;
  /** Override text colour. */
  color?: string;
  /** Extra CSS classes on the bubble element itself. */
  className?: string;
}

/**
 * A reusable chat bubble.
 *
 * - Bot bubbles sit on the left, have a flattened top-left corner.
 * - User bubbles sit on the right, have a flattened top-right corner.
 */
export function ChatBubble({
  variant,
  children,
  backgroundColor,
  color,
  className,
}: ChatBubbleProps) {
  const isBot = variant === 'bot';

  return (
    <div className={cn('flex', isBot ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[82%] px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm',
          isBot
            ? 'rounded-2xl rounded-tl-sm'
            : 'rounded-2xl rounded-tr-sm',
          className,
        )}
        style={{
          backgroundColor:
            backgroundColor ?? (isBot ? 'var(--gray-3)' : 'var(--orange-8)'),
          color: color ?? (isBot ? 'var(--gray-12)' : '#ffffff'),
        }}
      >
        {children}
      </div>
    </div>
  );
}
