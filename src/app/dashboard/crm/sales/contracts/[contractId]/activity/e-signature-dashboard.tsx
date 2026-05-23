'use client';

import * as React from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, Badge, Table, ZoruTableHeader, ZoruTableRow, ZoruTableHead, ZoruTableBody, ZoruTableCell } from '@/components/zoruui';
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
    <Card className="mt-6 border-zoru-line">
      <ZoruCardHeader className="border-b border-zoru-line pb-3">
        <ZoruCardTitle className="text-[14px] font-medium text-zoru-ink flex items-center gap-2">
          E-Signature Tracking Dashboard
          {provider !== 'none' && (
            <Badge variant="outline" className="ml-2 font-normal">
              Provider: {provider}
            </Badge>
          )}
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="pt-4">
        {provider === 'none' ? (
          <div className="text-sm text-zoru-ink-muted">
            E-signature is not enabled for this contract. Edit the contract to select a provider.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Signer</ZoruTableHead>
                  <ZoruTableHead>Role</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Last Activity</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {signers.map((s) => (
                  <ZoruTableRow key={s.id}>
                    <ZoruTableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-zoru-ink">{s.name}</span>
                        <span className="text-xs text-zoru-ink-muted flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {s.email}
                        </span>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink-muted">{s.role}</ZoruTableCell>
                    <ZoruTableCell>
                      {s.status === 'signed' ? (
                        <Badge variant="success" className="flex w-fit items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Signed
                        </Badge>
                      ) : s.status === 'viewed' ? (
                        <Badge variant="outline" className="flex w-fit items-center gap-1 text-blue-600 border-blue-200 bg-blue-50">
                          <Clock className="h-3 w-3" /> Viewed
                        </Badge>
                      ) : s.status === 'declined' ? (
                        <Badge variant="destructive" className="flex w-fit items-center gap-1">
                          <XCircle className="h-3 w-3" /> Declined
                        </Badge>
                      ) : (
                        <Badge variant="ghost" className="flex w-fit items-center gap-1 bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs text-zoru-ink-muted">
                      {s.lastActivity}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}
