import * as React from 'react';

export default function CrmAdvancedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col w-full h-full">
      {children}
    </div>
  );
}
