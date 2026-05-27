import { ZoruProvider } from '@/components/zoruui';
import type { ReactNode } from 'react';

export default function SabtablesLayout({ children }: { children: ReactNode }) {
  return (
    <ZoruProvider>
      <div className="zoruui min-h-screen w-full">{children}</div>
    </ZoruProvider>
  );
}
