import { SabScopeProvider } from '@/components/sabcrm/20ui';
import type { ReactNode } from 'react';

export default function SabtablesLayout({ children }: { children: ReactNode }) {
  return (
    <SabScopeProvider>
      <div className="zoruui min-h-screen w-full">{children}</div>
    </SabScopeProvider>
  );
}
