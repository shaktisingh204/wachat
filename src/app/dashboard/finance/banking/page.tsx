'use client';

import React, { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui/card';
import { Button } from '@/components/zoruui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/zoruui/table';
import { Badge } from '@/components/zoruui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsapCore from 'gsap';

gsapCore.registerPlugin(useGSAP);

export default function BankingReconciliationPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsapCore.from('.animate-panel', {
      x: (index) => index === 0 ? -20 : 20,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.1
    });

    gsapCore.from('.animate-row', {
      opacity: 0,
      y: 10,
      duration: 0.3,
      stagger: 0.05,
      delay: 0.2
    });
  }, { scope: containerRef });

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-64px)] flex flex-col" ref={containerRef}>
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            Open Banking & Reconciliation
          </h1>
          <p className="text-muted-foreground mt-1">
            Algorithmic transaction matching powered by AI.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Feeds
          </Button>
          <Button>Auto-Reconcile All</Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Pane: Bank Feed */}
        <Card className="animate-panel flex flex-col min-h-0 border-r-4 border-r-blue-500/20">
          <CardHeader className="bg-muted/30 pb-4 shrink-0">
            <div className="flex justify-between items-center">
              <CardTitle>Live Bank Statement</CardTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                ICICI Connected Banking
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { date: 'Oct 24', desc: 'RAZORPAY SETTLEMENT', amount: '+₹45,200.00', status: 'match' },
                  { date: 'Oct 23', desc: 'AWS EMEA SARL', amount: '-₹12,450.00', status: 'partial' },
                  { date: 'Oct 22', desc: 'NEFT-SBIN-JOHN DOE', amount: '+₹5,000.00', status: 'unmatched' },
                  { date: 'Oct 21', desc: 'ZOHO CORP RENEWAL', amount: '-₹3,200.00', status: 'match' },
                ].map((txn, i) => (
                  <TableRow key={i} className={`animate-row cursor-pointer hover:bg-muted/50 ${i === 0 ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
                    <TableCell className="whitespace-nowrap">{txn.date}</TableCell>
                    <TableCell className="font-medium text-sm">
                      {txn.desc}
                      {txn.status === 'match' && <Badge variant="default" className="ml-2 bg-emerald-500 hover:bg-emerald-600">AI Match</Badge>}
                      {txn.status === 'partial' && <Badge variant="secondary" className="ml-2">Needs Review</Badge>}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${txn.amount.startsWith('+') ? 'text-emerald-600' : ''}`}>
                      {txn.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right Pane: Ledger Match */}
        <Card className="animate-panel flex flex-col min-h-0 relative">
          <CardHeader className="bg-muted/30 pb-4 shrink-0">
            <CardTitle>SabFinance Ledger Match</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center space-y-6">
            
            <div className="w-full max-w-md p-6 border rounded-xl bg-card shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <CheckCircle2 className="w-24 h-24" />
              </div>
              <div className="flex items-center gap-3 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="font-semibold text-lg">99% Confidence Match</h3>
              </div>
              <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-sm border-b pb-2">
                  <span className="text-muted-foreground">Bank Line:</span>
                  <span className="font-medium">RAZORPAY SETTLEMENT</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-2">
                  <span className="text-muted-foreground">Ledger Voucher:</span>
                  <span className="font-medium">RV-1024 (Multiple Invoices)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Difference:</span>
                  <span className="font-medium text-emerald-600">₹0.00</span>
                </div>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                Confirm & Reconcile (Enter)
              </Button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Or search for a different ledger entry manually</p>
              <Button variant="outline" className="w-full max-w-md">Browse Ledger (Alt+L)</Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
