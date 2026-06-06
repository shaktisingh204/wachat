'use client';

import { Button } from '@/components/sabcrm/20ui';
import { FileDown, Receipt } from 'lucide-react';
import Link from 'next/link';

export function QuotationFloatingBar({ quotationId }: { quotationId: string }) {
  // A simple floating bar placed at the bottom center of the screen
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/95 px-5 py-3 shadow-[var(--st-shadow-lg)] backdrop-blur-sm z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
      <Button size="sm" variant="outline" asChild className="rounded-full shadow-sm">
        <Link href={`/dashboard/crm/sales/invoices/new?fromKind=quotation&fromId=${quotationId}`}>
          <Receipt className="mr-2 h-4 w-4 text-[var(--st-text)]" />
          Convert to Invoice
        </Link>
      </Button>
      <Button size="sm" variant="default" className="rounded-full shadow-sm" asChild>
        <a href={`/dashboard/crm/sales/quotations/${quotationId}?print=1&autoPrint=1`} target="_blank" rel="noopener noreferrer">
          <FileDown className="mr-2 h-4 w-4" />
          1-Click PDF Export
        </a>
      </Button>
    </div>
  );
}
