'use client';

import React, { useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { RefreshCw, CheckCircle2, Building2 } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsapCore from 'gsap';

gsapCore.registerPlugin(useGSAP);

type BankTxn = {
  date: string;
  desc: string;
  amount: string;
  status: 'match' | 'partial' | 'unmatched';
};

const BANK_TXNS: BankTxn[] = [
  { date: 'Oct 24', desc: 'RAZORPAY SETTLEMENT', amount: '+₹45,200.00', status: 'match' },
  { date: 'Oct 23', desc: 'AWS EMEA SARL', amount: '-₹12,450.00', status: 'partial' },
  { date: 'Oct 22', desc: 'NEFT-SBIN-JOHN DOE', amount: '+₹5,000.00', status: 'unmatched' },
  { date: 'Oct 21', desc: 'ZOHO CORP RENEWAL', amount: '-₹3,200.00', status: 'match' },
];

export default function BankingReconciliationPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsapCore.from('.animate-panel', {
      x: (index) => (index === 0 ? -20 : 20),
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.1,
    });

    gsapCore.from('.animate-row', {
      opacity: 0,
      y: 10,
      duration: 0.3,
      stagger: 0.05,
      delay: 0.2,
    });
  }, { scope: containerRef });

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-64px)] flex flex-col" ref={containerRef}>
      <PageHeader className="shrink-0">
        <PageHeaderHeading>
          <PageEyebrow>Finance</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
            Banking &amp; reconciliation
          </PageTitle>
          <PageDescription>
            Live bank feeds matched to your ledger, with suggested matches ranked by confidence.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" iconLeft={RefreshCw}>
            Sync feeds
          </Button>
          <Button variant="primary">Auto-reconcile all</Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Pane: Bank Feed */}
        <Card padding="none" className="animate-panel flex flex-col min-h-0">
          <CardHeader className="shrink-0">
            <div className="flex justify-between items-center gap-3">
              <CardTitle>Live bank statement</CardTitle>
              <Badge tone="info" kind="outline" dot>
                ICICI connected
              </Badge>
            </div>
          </CardHeader>
          <CardBody className="flex-1 overflow-auto p-0">
            <Table stickyHeader>
              <THead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th align="right">Amount</Th>
                </Tr>
              </THead>
              <TBody>
                {BANK_TXNS.map((txn, i) => (
                  <Tr
                    key={txn.date}
                    selected={i === 0}
                    className="animate-row cursor-pointer"
                  >
                    <Td className="whitespace-nowrap">{txn.date}</Td>
                    <Td className="font-medium text-sm">
                      {txn.desc}
                      {txn.status === 'match' && (
                        <Badge tone="success" className="ml-2">
                          AI Match
                        </Badge>
                      )}
                      {txn.status === 'partial' && (
                        <Badge tone="warning" className="ml-2">
                          Needs Review
                        </Badge>
                      )}
                    </Td>
                    <Td
                      align="right"
                      className={
                        txn.amount.startsWith('+')
                          ? 'font-medium tabular-nums text-[var(--st-status-ok)]'
                          : 'font-medium tabular-nums'
                      }
                    >
                      {txn.amount}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>

        {/* Right Pane: Ledger Match */}
        <Card padding="none" className="animate-panel flex flex-col min-h-0 relative">
          <CardHeader className="shrink-0">
            <CardTitle>Ledger match</CardTitle>
          </CardHeader>
          <CardBody className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center gap-6">
            <Card
              variant="outlined"
              padding="lg"
              className="w-full max-w-md relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10" aria-hidden="true">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <div className="flex items-center gap-3 text-[var(--st-status-ok)]">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                <h3 className="font-semibold text-lg">99% confidence match</h3>
              </div>
              <div className="mt-4 space-y-2 relative z-10">
                <div className="flex justify-between text-sm border-b border-[var(--st-border)] pb-2">
                  <span className="text-[var(--st-text-secondary)]">Bank line</span>
                  <span className="font-medium">Razorpay settlement</span>
                </div>
                <div className="flex justify-between text-sm border-b border-[var(--st-border)] pb-2">
                  <span className="text-[var(--st-text-secondary)]">Ledger voucher</span>
                  <span className="font-medium">RV-1024 · multiple invoices</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)]">Difference</span>
                  <span className="font-medium tabular-nums text-[var(--st-status-ok)]">₹0.00</span>
                </div>
              </div>
              <Button variant="primary" block className="mt-4">
                Confirm and reconcile
              </Button>
            </Card>

            <div className="text-center space-y-2 w-full max-w-md">
              <p className="text-sm text-[var(--st-text-secondary)]">
                Or pick a different ledger entry by hand.
              </p>
              <Button variant="outline" block>
                Browse ledger
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
