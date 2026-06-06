'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import { LoaderCircle, SplitSquareVertical } from 'lucide-react';
import { useTransition } from 'react';
import { splitSalesOrderBackorderAction } from '@/app/actions/crm/sales-orders-split.actions';

export function SplitBackorderedButton({ salesOrderId }: { salesOrderId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSplit = () => {
    startTransition(async () => {
      const result = await splitSalesOrderBackorderAction(salesOrderId);
      if (result.success) {
        toast({ title: 'Order Split', description: result.message });
      } else {
        toast({ title: 'Split Failed', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSplit} disabled={isPending}>
      {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <SplitSquareVertical className="h-3.5 w-3.5" />}
      Split (Backordered)
    </Button>
  );
}
