'use client';

import * as React from 'react';
import { Button } from '@/components/zoruui';
import { Printer, Mail, MessageCircle } from 'lucide-react';

export function ReceiptShareActions({
  receiptId,
  receiptNo,
  amount,
  currency,
}: {
  receiptId: string;
  receiptNo?: string;
  amount?: number;
  currency?: string;
}) {
  const handlePrint = () => {
    window.open(`/dashboard/crm/sales/receipts/${receiptId}?print=1`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Payment Receipt - ${receiptNo || 'New'}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease find your payment receipt ${receiptNo || ''} attached.\nTotal: ${currency || 'INR'} ${amount || 0}\n\nThank you!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello! Your payment receipt ${receiptNo || ''} for ${currency || 'INR'} ${amount || 0} has been generated.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <>
      <Button variant="outline" onClick={handlePrint} title="Print Receipt">
        <Printer className="h-4 w-4" /> Print
      </Button>
      <Button variant="outline" onClick={handleEmail} title="Email Receipt">
        <Mail className="h-4 w-4" /> Email
      </Button>
      <Button variant="outline" onClick={handleWhatsApp} title="WhatsApp Receipt">
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </Button>
    </>
  );
}
