'use client';

import * as React from 'react';
import { Printer } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

export function PrintButton(): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      iconLeft={Printer}
      onClick={() => window.print()}
    >
      Print
    </Button>
  );
}
