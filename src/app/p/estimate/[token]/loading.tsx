import { Card, CardBody, CardHeader, CardTitle, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';
import { Database, FileText } from 'lucide-react';

export default function LoadingEstimate() {
  return (
    <div className="grid gap-8 lg:grid-cols-5 animate-pulse">
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-12 bg-[var(--st-bg-muted)] rounded" />
            <div className="h-5 w-32 bg-[var(--st-bg-muted)] rounded" />
          </div>
          <div className="mt-2 h-8 w-3/4 bg-[var(--st-bg-muted)] rounded" />
          <div className="mt-1.5 h-4 w-1/2 bg-[var(--st-bg-muted)] rounded" />
        </div>

        <Card>
          <CardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <CardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text-secondary)]">
                Request Parameters
              </CardTitle>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <Table>
              <THead className="bg-[var(--st-bg-muted)]/20">
                <Tr>
                  <Th>Parameter</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Value</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td><div className="h-4 w-20 bg-[var(--st-bg-muted)] rounded" /></Td>
                  <Td><div className="h-4 w-12 bg-[var(--st-bg-muted)] rounded" /></Td>
                  <Td><div className="h-4 w-24 bg-[var(--st-bg-muted)] rounded ml-auto" /></Td>
                </Tr>
                <Tr>
                  <Td><div className="h-4 w-24 bg-[var(--st-bg-muted)] rounded" /></Td>
                  <Td><div className="h-4 w-16 bg-[var(--st-bg-muted)] rounded" /></Td>
                  <Td><div className="h-5 w-20 bg-[var(--st-bg-muted)] rounded ml-auto" /></Td>
                </Tr>
              </TBody>
            </Table>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-[var(--st-text-secondary)] px-1">
            <FileText className="h-4 w-4" />
            <span>Project Requirements (Description)</span>
          </div>
          <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)]/35 p-5">
            <div className="space-y-2">
              <div className="h-4 w-full bg-[var(--st-bg-muted)] rounded" />
              <div className="h-4 w-5/6 bg-[var(--st-bg-muted)] rounded" />
              <div className="h-4 w-4/6 bg-[var(--st-bg-muted)] rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="h-5 w-12 bg-[var(--st-bg-muted)] rounded" />
            <div className="h-5 w-40 bg-[var(--st-bg-muted)] rounded" />
          </div>
          <Card className="h-64 bg-[var(--st-bg-muted)]/20 border-[var(--st-border)]" />
        </div>
      </div>
    </div>
  );
}
