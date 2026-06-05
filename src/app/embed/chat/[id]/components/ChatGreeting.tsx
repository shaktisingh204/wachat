'use client';

interface ChatGreetingProps {
  greeting: string;
}

export function ChatGreeting({ greeting }: ChatGreetingProps) {
  if (!greeting) return null;
  return (
    <p
      style={{
        padding: '12px 16px',
        margin: 0,
        fontSize: 13,
        color: 'var(--st-text-secondary)',
        borderBottom: '1px solid var(--st-border)',
      }}
    >
      {greeting}
    </p>
  );
}
