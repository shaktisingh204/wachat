'use client';

interface ChatGreetingProps {
  greeting: string;
}

export function ChatGreeting({ greeting }: ChatGreetingProps) {
  if (!greeting) return null;
  return (
    <p className="m-0 border-b border-[var(--st-border)] px-4 py-3 text-[13px] text-[var(--st-text-secondary)]">
      {greeting}
    </p>
  );
}
