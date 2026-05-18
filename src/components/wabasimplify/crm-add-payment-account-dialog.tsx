
'use client';

import { useState } from 'react';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { Banknote, Building2, User, Plus } from 'lucide-react';
import Link from 'next/link';

// THIS COMPONENT IS DEPRECATED AND WILL BE REMOVED.
// The functionality has been moved to /dashboard/crm/banking/all/new

export function CrmAddPaymentAccountDialog() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <ZoruDialogHeader className="px-6 pt-6 pb-2">
          <ZoruDialogTitle className="text-foreground">Add New Payment Account</ZoruDialogTitle>
          <ZoruDialogDescription className="text-muted-foreground">
            This feature has moved to a dedicated page for a better experience.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-2 text-center">
          <p className="mb-4 text-muted-foreground">Please use the new page to add payment accounts.</p>
          <ZoruButton asChild>
            <Link href="/dashboard/crm/banking/all/new">
              Go to Add Account Page
            </Link>
          </ZoruButton>
        </div>
        <ZoruDialogFooter className="px-6 pb-6 pt-2">
          <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Close</ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
