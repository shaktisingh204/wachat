'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
} from '@/components/zoruui';
import {
  useState } from 'react';

import { Banknote, Building2, User, Plus } from 'lucide-react';
import Link from 'next/link';

// THIS COMPONENT IS DEPRECATED AND WILL BE REMOVED.
// The functionality has been moved to /dashboard/crm/banking/all/new

export function CrmAddPaymentAccountDialog() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <ZoruDialogHeader className="px-6 pt-6 pb-2">
          <ZoruDialogTitle className="text-zoru-ink">Add New Payment Account</ZoruDialogTitle>
          <ZoruDialogDescription className="text-zoru-ink-muted">
            This feature has moved to a dedicated page for a better experience.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-2 text-center">
          <p className="mb-4 text-zoru-ink-muted">Please use the new page to add payment accounts.</p>
          <Button asChild>
            <Link href="/dashboard/crm/banking/all/new">
              Go to Add Account Page
            </Link>
          </Button>
        </div>
        <ZoruDialogFooter className="px-6 pb-6 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
