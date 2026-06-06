'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardBody, Badge, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';
import { Mail, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'viewed' | 'signed' | 'declined';
  lastActivity?: string;
}

interface ESignatureDashboardProps {
  contractId: string;
  provider: string;
  partyName: string;
  partyEmail: string;
}

export function ESignatureDashboard({ contractId, provider, partyName, partyEmail }: ESignatureDashboardProps) {
  // Dummy data for tracking
  const signers: Signer[] = [
    {
      id: '1',
      name: partyName || 'Counterparty',
      email: partyEmail || 'pending@example.com',
      role: 'Client',
      status: 'pending',
      lastActivity: 'Not viewed yet',
    },
    {
      id: '2',
      name: 'Our Organization',
      email: 'legal@ourorg.com',
      role: 'Sender',
      status: 'signed',
      lastActivity: new Date().toLocaleDateString(),
    }
  ];

  return (
    <Card className="mt-6 border-[var(--st-border)]">
      <CardHeader className="border-b border-[var(--st-border)] pb-3">
        <CardTitle className="text-[14px] font-medium text-[var(--st-text)] flex items-center gap-2">
          E-Signature Tracking Dashboard
          {provider !== 'none' && (
            <Badge variant="outline" className="ml-2 font-normal">
              Provider: {provider}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardBody className="pt-4">
        {provider === 'none' ? (
          <div className="text-sm text-[var(--st-text-secondary)]">
            E-signature is not enabled for this contract. Edit the contract to select a provider.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  <Th>Signer</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Last Activity</Th>
                </Tr>
              </THead>
              <TBody>
                {signers.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--st-text)]">{s.name}</span>
                        <span className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {s.email}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">{s.role}</Td>
                    <Td>
                      {s.status === 'signed' ? (
                        <Badge variant="success" className="flex w-fit items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Signed
                        </Badge>
                      ) : s.status === 'viewed' ? (
                        <Badge variant="outline" className="flex w-fit items-center gap-1 text-[var(--st-text)] border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                          <Clock className="h-3 w-3" /> Viewed
                        </Badge>
                      ) : s.status === 'declined' ? (
                        <Badge variant="destructive" className="flex w-fit items-center gap-1">
                          <XCircle className="h-3 w-3" /> Declined
                        </Badge>
                      ) : (
                        <Badge variant="ghost" className="flex w-fit items-center gap-1 bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right text-xs text-[var(--st-text-secondary)]">
                      {s.lastActivity}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
