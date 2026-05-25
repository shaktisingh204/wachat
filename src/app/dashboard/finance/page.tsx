import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui/card';
import { Button } from '@/components/zoruui/button';
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function FinanceDashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Overview</h1>
          <p className="text-muted-foreground mt-1">
            Real-time insights into your business finances.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/finance/vouchers">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              New Voucher (Alt+V)
            </Button>
          </Link>
          <Link href="/dashboard/finance/reports">
            <Button variant="outline">
              View Reports
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹45,231.89</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-emerald-500">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹12,450.00</div>
            <p className="text-xs text-muted-foreground mt-1">
              8 invoices pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Accounts Payable</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹8,210.50</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1 text-rose-500">
              <ArrowDownRight className="w-3 h-3 mr-1" />
              -4% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Cash at Bank</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹89,432.00</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 3 accounts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Cash Flow Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground border-t">
            Chart Component (Requires Recharts or similar)
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="border-t pt-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Invoice #INV-{1000 + i}</p>
                  <p className="text-xs text-muted-foreground">Tech Solutions Ltd.</p>
                </div>
                <div className="font-medium text-sm">
                  +₹{Math.floor(Math.random() * 5000) + 1000}.00
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
