import type { ReactNode } from 'react';

export default function SabtablesLayout({ children }: { children: ReactNode }) {
  return <div className="20ui min-h-screen w-full antialiased">{children}</div>;
}
