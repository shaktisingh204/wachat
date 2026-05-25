'use client';

import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui/card';
import { Button } from '@/components/zoruui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/zoruui/table';
import { useGSAP } from '@gsap/react';
import gsapCore from 'gsap';
import { Download, Printer } from 'lucide-react';

gsapCore.registerPlugin(useGSAP);

export default function ReportsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeReport, setActiveReport] = useState<'trial_balance' | 'pl' | 'balance_sheet'>('trial_balance');

  useGSAP(() => {
    gsapCore.from('.animate-fade', {
      y: 15,
      opacity: 0,
      stagger: 0.1,
      duration: 0.4,
      ease: 'power2.out'
    });
  }, { scope: containerRef, dependencies: [activeReport] });

  return (
    <div className="p-6 space-y-6" ref={containerRef}>
      <div className="animate-fade flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">
            Real-time interactive reports.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="animate-fade flex space-x-2 border-b pb-2">
        <Button 
          variant={activeReport === 'trial_balance' ? 'default' : 'ghost'} 
          onClick={() => setActiveReport('trial_balance')}
        >
          Trial Balance
        </Button>
        <Button 
          variant={activeReport === 'pl' ? 'default' : 'ghost'} 
          onClick={() => setActiveReport('pl')}
        >
          Profit & Loss
        </Button>
        <Button 
          variant={activeReport === 'balance_sheet' ? 'default' : 'ghost'} 
          onClick={() => setActiveReport('balance_sheet')}
        >
          Balance Sheet
        </Button>
      </div>

      <Card className="animate-fade">
        <CardHeader>
          <CardTitle>
            {activeReport === 'trial_balance' && 'Trial Balance as of Today'}
            {activeReport === 'pl' && 'Profit & Loss Statement (Current FY)'}
            {activeReport === 'balance_sheet' && 'Balance Sheet as of Today'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeReport === 'trial_balance' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Particulars</TableHead>
                  <TableHead className="text-right">Debit (₹)</TableHead>
                  <TableHead className="text-right">Credit (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Cash in Hand</TableCell>
                  <TableCell className="text-right">45,000.00</TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Bank Accounts</TableCell>
                  <TableCell className="text-right">1,25,000.00</TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Sales Account</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right">3,50,000.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Capital Account</TableCell>
                  <TableCell className="text-right"></TableCell>
                  <TableCell className="text-right">5,00,000.00</TableCell>
                </TableRow>
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">8,50,000.00</TableCell>
                  <TableCell className="text-right">8,50,000.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {activeReport === 'pl' && (
            <div className="text-center text-muted-foreground py-10">
              Profit & Loss statement visualization goes here.
            </div>
          )}

          {activeReport === 'balance_sheet' && (
            <div className="text-center text-muted-foreground py-10">
              Balance Sheet visualization goes here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
