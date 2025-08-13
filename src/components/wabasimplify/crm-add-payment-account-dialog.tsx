
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Banknote, Building2, User } from 'lucide-react';

export function CrmAddPaymentAccountDialog() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add Account</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Payment Account</DialogTitle>
          <DialogDescription>
            Which type of account would you like to add?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            <Card onClick={() => setSelectedType('bank')} className={`cursor-pointer ${selectedType === 'bank' && 'ring-2 ring-primary'}`}>
                <CardHeader className="items-center"><Banknote className="h-8 w-8 text-primary"/></CardHeader>
                <CardContent className="text-center"><p className="font-semibold">Bank Account</p><p className="text-xs text-muted-foreground">All types of bank accounts</p></CardContent>
            </Card>
             <Card onClick={() => setSelectedType('employee')} className={`cursor-pointer ${selectedType === 'employee' && 'ring-2 ring-primary'}`}>
                <CardHeader className="items-center"><User className="h-8 w-8 text-primary"/></CardHeader>
                <CardContent className="text-center"><p className="font-semibold">Employee Account</p><p className="text-xs text-muted-foreground">Manage and track salaries</p></CardContent>
            </Card>
             <Card onClick={() => setSelectedType('other')} className={`cursor-pointer ${selectedType === 'other' && 'ring-2 ring-primary'}`}>
                <CardHeader className="items-center"><Building2 className="h-8 w-8 text-primary"/></CardHeader>
                <CardContent className="text-center"><p className="font-semibold">Other Account</p><p className="text-xs text-muted-foreground">Cash, UPI, Wallets, etc.</p></CardContent>
            </Card>
        </div>
        <p className="text-xs text-center text-muted-foreground">Add Accounts to easily manage and track your withdrawals, deposits, salaries, reimbursements and more. <a href="#" className="text-primary hover:underline">Learn More</a></p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={!selectedType}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
