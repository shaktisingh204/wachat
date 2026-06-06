'use client';

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  SegmentedControl,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { Download, Printer, BarChart3, Scale } from 'lucide-react';

type ReportKey = 'trial_balance' | 'pl' | 'balance_sheet';

const REPORT_OPTIONS: ReadonlyArray<{ value: ReportKey; label: string }> = [
  { value: 'trial_balance', label: 'Trial Balance' },
  { value: 'pl', label: 'Profit & Loss' },
  { value: 'balance_sheet', label: 'Balance Sheet' },
];

const REPORT_TITLE: Record<ReportKey, string> = {
  trial_balance: 'Trial Balance as of Today',
  pl: 'Profit & Loss Statement (Current FY)',
  balance_sheet: 'Balance Sheet as of Today',
};

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportKey>('trial_balance');

  return (
    <div className="p-6 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Financial Reports</PageTitle>
          <PageDescription>Real-time interactive reports.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" size="sm" iconLeft={Printer}>
            Print
          </Button>
          <Button variant="outline" size="sm" iconLeft={Download}>
            Export Excel
          </Button>
        </PageActions>
      </PageHeader>

      <SegmentedControl
        aria-label="Select report"
        items={REPORT_OPTIONS}
        value={activeReport}
        onChange={setActiveReport}
      />

      <Card>
        <CardHeader>
          <CardTitle>{REPORT_TITLE[activeReport]}</CardTitle>
        </CardHeader>
        <CardBody>
          {activeReport === 'trial_balance' && (
            <Table>
              <THead>
                <Tr>
                  <Th>Particulars</Th>
                  <Th align="right">Debit (₹)</Th>
                  <Th align="right">Credit (₹)</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td className="font-medium">Cash in Hand</Td>
                  <Td align="right">45,000.00</Td>
                  <Td align="right" />
                </Tr>
                <Tr>
                  <Td className="font-medium">Bank Accounts</Td>
                  <Td align="right">1,25,000.00</Td>
                  <Td align="right" />
                </Tr>
                <Tr>
                  <Td className="font-medium">Sales Account</Td>
                  <Td align="right" />
                  <Td align="right">3,50,000.00</Td>
                </Tr>
                <Tr>
                  <Td className="font-medium">Capital Account</Td>
                  <Td align="right" />
                  <Td align="right">5,00,000.00</Td>
                </Tr>
                <Tr className="font-bold border-t-2 border-[var(--st-border)]">
                  <Td>Total</Td>
                  <Td align="right">8,50,000.00</Td>
                  <Td align="right">8,50,000.00</Td>
                </Tr>
              </TBody>
            </Table>
          )}

          {activeReport === 'pl' && (
            <EmptyState
              icon={BarChart3}
              title="Profit & Loss statement"
              description="The Profit & Loss visualization will appear here."
            />
          )}

          {activeReport === 'balance_sheet' && (
            <EmptyState
              icon={Scale}
              title="Balance Sheet"
              description="The Balance Sheet visualization will appear here."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
