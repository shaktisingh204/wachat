import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Table, ZoruTableHeader, ZoruTableRow, ZoruTableHead, ZoruTableBody, ZoruTableCell } from '@/components/zoruui';
import { Database, FileText } from 'lucide-react';

export default function LoadingEstimate() {
  return (
    <div className="grid gap-8 lg:grid-cols-5 animate-pulse">
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-12 bg-zoru-surface-2 rounded" />
            <div className="h-5 w-32 bg-zoru-surface-2 rounded" />
          </div>
          <div className="mt-2 h-8 w-3/4 bg-zoru-surface-2 rounded" />
          <div className="mt-1.5 h-4 w-1/2 bg-zoru-surface-2 rounded" />
        </div>

        <Card>
          <ZoruCardHeader className="border-b border-zoru-line py-3 bg-zoru-surface-2/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-zoru-ink-muted" />
              <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-zoru-ink-muted">
                Request Parameters
              </ZoruCardTitle>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader className="bg-zoru-surface-2/20">
                <ZoruTableRow>
                  <ZoruTableHead>Parameter</ZoruTableHead>
                  <ZoruTableHead>Type</ZoruTableHead>
                  <ZoruTableHead className="text-right">Value</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell><div className="h-4 w-20 bg-zoru-surface-2 rounded" /></ZoruTableCell>
                  <ZoruTableCell><div className="h-4 w-12 bg-zoru-surface-2 rounded" /></ZoruTableCell>
                  <ZoruTableCell><div className="h-4 w-24 bg-zoru-surface-2 rounded ml-auto" /></ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell><div className="h-4 w-24 bg-zoru-surface-2 rounded" /></ZoruTableCell>
                  <ZoruTableCell><div className="h-4 w-16 bg-zoru-surface-2 rounded" /></ZoruTableCell>
                  <ZoruTableCell><div className="h-5 w-20 bg-zoru-surface-2 rounded ml-auto" /></ZoruTableCell>
                </ZoruTableRow>
              </ZoruTableBody>
            </Table>
          </ZoruCardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-zoru-ink-muted px-1">
            <FileText className="h-4 w-4" />
            <span>Project Requirements (Description)</span>
          </div>
          <div className="rounded-xl border border-zoru-line bg-zoru-surface-2/35 p-5">
            <div className="space-y-2">
              <div className="h-4 w-full bg-zoru-surface-2 rounded" />
              <div className="h-4 w-5/6 bg-zoru-surface-2 rounded" />
              <div className="h-4 w-4/6 bg-zoru-surface-2 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="h-5 w-12 bg-zoru-surface-2 rounded" />
            <div className="h-5 w-40 bg-zoru-surface-2 rounded" />
          </div>
          <Card className="h-64 bg-zoru-surface-2/20 border-zoru-line" />
        </div>
      </div>
    </div>
  );
}
