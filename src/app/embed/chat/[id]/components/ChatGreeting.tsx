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
        color: '#475569',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      {greeting}
    </p>
  );
}
