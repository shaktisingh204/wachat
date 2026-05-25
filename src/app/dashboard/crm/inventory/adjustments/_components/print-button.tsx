'use client';

import { Button } from '@/components/zoruui';
import { Printer } from 'lucide-react';

export function PrintButton() {
    return (
        <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
            Print
        </Button>
    );
}
