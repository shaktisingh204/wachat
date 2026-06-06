import type { ReactNode } from 'react';

export default function SabcreatorLayout({ children }: { children: ReactNode }) {
  return <div className="ui20 min-h-screen bg-[var(--st-bg-secondary)]">{children}</div>;
}
