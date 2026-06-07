'use client';

interface TypingIndicatorProps {
  /** Background colour of the bubble (falls back to the 20ui surface token). */
  backgroundColor?: string;
  /** Dot colour (falls back to the 20ui tertiary text token). */
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
        className="flex items-center gap-[5px] rounded-2xl rounded-tl-sm border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3 shadow-sm"
        style={backgroundColor ? { backgroundColor } : undefined}
        aria-label="Bot is typing"
        role="status"
      >
        {([0, 1, 2] as const).map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="block h-2 w-2 animate-bounce rounded-full bg-[var(--st-text-tertiary)]"
            style={{
              ...(dotColor ? { backgroundColor: dotColor } : null),
              animationDelay: `${i * 140}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}
