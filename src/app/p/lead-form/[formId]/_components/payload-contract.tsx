import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Badge,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
} from '@/components/sabcrm/20ui/compat';
import { Database } from 'lucide-react';
import type { LeadFormField } from '../types';

export function PayloadContractCard({ fields }: { fields: LeadFormField[] }) {
  return (
    <Card>
      <ZoruCardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text-secondary)]">
            Payload Contract Attributes
          </ZoruCardTitle>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="p-0">
        <Table>
          <ZoruTableHeader className="bg-[var(--st-bg-muted)]/20">
            <ZoruTableRow>
              <ZoruTableHead className="font-mono text-[11.5px]">Parameter</ZoruTableHead>
              <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
              <ZoruTableHead className="font-mono text-[11.5px] text-right">Requirement</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">name</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Badge variant="danger">REQUIRED</Badge>
              </ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">email</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Badge variant="danger">REQUIRED</Badge>
              </ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">phone</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Badge variant="outline">OPTIONAL</Badge>
              </ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">company</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Badge variant="outline">OPTIONAL</Badge>
              </ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">message</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Badge variant="outline">OPTIONAL</Badge>
              </ZoruTableCell>
            </ZoruTableRow>
            {fields.map((f) => (
              <ZoruTableRow key={f._id}>
                <ZoruTableCell className="font-mono text-[12.5px]">{String(f.field_name || '')}</ZoruTableCell>
                <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">{String(f.field_type || 'string')}</ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <Badge variant={f.is_required ? 'danger' : 'outline'}>
                    {f.is_required ? 'REQUIRED' : 'OPTIONAL'}
                  </Badge>
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
          </ZoruTableBody>
        </Table>
      </ZoruCardContent>
    </Card>
  );
}
