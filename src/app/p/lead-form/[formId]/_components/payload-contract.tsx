import { Card, CardBody, CardHeader, CardTitle, Badge, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui/compat';
import { Database } from 'lucide-react';
import type { LeadFormField } from '../types';

export function PayloadContractCard({ fields }: { fields: LeadFormField[] }) {
  return (
    <Card>
      <CardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <CardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text-secondary)]">
            Payload Contract Attributes
          </CardTitle>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <Table>
          <THead className="bg-[var(--st-bg-muted)]/20">
            <Tr>
              <Th className="font-mono text-[11.5px]">Parameter</Th>
              <Th className="font-mono text-[11.5px]">Type</Th>
              <Th className="font-mono text-[11.5px] text-right">Requirement</Th>
            </Tr>
          </THead>
          <TBody>
            <Tr>
              <Td className="font-mono text-[12.5px]">name</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
              <Td className="text-right">
                <Badge variant="danger">REQUIRED</Badge>
              </Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">email</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
              <Td className="text-right">
                <Badge variant="danger">REQUIRED</Badge>
              </Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">phone</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
              <Td className="text-right">
                <Badge variant="outline">OPTIONAL</Badge>
              </Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">company</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
              <Td className="text-right">
                <Badge variant="outline">OPTIONAL</Badge>
              </Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">message</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
              <Td className="text-right">
                <Badge variant="outline">OPTIONAL</Badge>
              </Td>
            </Tr>
            {fields.map((f) => (
              <Tr key={f._id}>
                <Td className="font-mono text-[12.5px]">{String(f.field_name || '')}</Td>
                <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">{String(f.field_type || 'string')}</Td>
                <Td className="text-right">
                  <Badge variant={f.is_required ? 'danger' : 'outline'}>
                    {f.is_required ? 'REQUIRED' : 'OPTIONAL'}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
