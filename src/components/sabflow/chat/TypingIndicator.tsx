'use client';

interface TypingIndicatorProps {
  /** Background colour of the bubble (falls back to CSS var). */
  backgroundColor?: string;
  /** Dot colour — defaults to currentColor at 50% opacity. */
  dotColor?: string;
}

/**
 * Three animated bouncing dots that indicate the bot is "typing".
 * Rendered as a left-aligned host bubble so it sits naturally in the
 * message stream.
 */
export function TypingIndicator({ backgroundColor, dotColor }: TypingIndicatorProps) {
  return (
    <div className="flex items-start gap-2">
      <div
        className="flex items-center gap-[5px] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
        style={{ backgroundColor: backgroundColor ?? 'var(--gray-3)' }}
        aria-label="Bot is typing"
        role="status"
      >
        {([0, 1, 2] as const).map((i) => (
          <span
            key={i}
            className="block h-2 w-2 rounded-full animate-bounce"
            style={{
              backgroundColor: dotColor ?? 'var(--gray-9)',
              animationDelay: `${i * 140}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}
