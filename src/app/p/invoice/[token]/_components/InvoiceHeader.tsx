'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/zoruui';
import { InvoiceData } from '../types';

export function InvoiceHeader({ token, invoice }: { token: string, invoice: InvoiceData }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="rounded bg-zoru-surface-2 border border-zoru-line px-2 py-0.5 font-mono text-[11px] font-bold text-zoru-ink uppercase">
            GET
          </span>
          <span className="font-mono text-[13px] text-zoru-ink tracking-tight">
            /v1/invoices/{token.slice(0, 8)}...
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zoru-ink font-mono">
          {String(invoice.invoiceNumber || invoice.invoice_number || 'INV-SPECIFICATION')}
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Below are the financial balances and historical transaction states for invoice audit.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={handlePrint} className="font-mono text-xs hidden print:hidden sm:flex">
        <Printer className="w-4 h-4 mr-2" />
        Download PDF
      </Button>
    </div>
  );
}
