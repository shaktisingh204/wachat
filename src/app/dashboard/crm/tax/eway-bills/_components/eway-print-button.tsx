'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/zoruui';

export function EWayPrintButton() {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        if (typeof window !== 'undefined') window.print();
      }}
    >
      <Printer className="h-4 w-4" />
      Print
    </Button>
  );
}
