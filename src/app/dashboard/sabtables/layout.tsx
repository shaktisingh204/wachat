import type { ReactNode } from 'react';

export default function SabtablesLayout({ children }: { children: ReactNode }) {
  return <div className="ui20 min-h-screen w-full antialiased">{children}</div>;
}
