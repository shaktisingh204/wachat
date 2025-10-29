
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
import { Banknote, Building2, User, Plus } from 'lucide-react';
import Link from 'next/link';

// THIS COMPONENT IS DEPRECATED AND WILL BE REMOVED.
// The functionality has been moved to /dashboard/crm/banking/all/new

export function CrmAddPaymentAccountDialog() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Payment Account</DialogTitle>
          <DialogDescription>
            This feature has moved to a dedicated page for a better experience.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center">
            <p className="mb-4">Please use the new page to add payment accounts.</p>
            <Button asChild>
                <Link href="/dashboard/crm/banking/all/new">
                    Go to Add Account Page
                </Link>
            </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
