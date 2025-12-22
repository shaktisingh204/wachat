
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';

interface OrderMessageContentProps {
  order: {
    catalog_id: string;
    product_items: {
      product_retailer_id: string;
      quantity: string;
      item_price: string;
      currency: string;
    }[];
    text?: string;
  };
}

export function OrderMessageContent({ order }: OrderMessageContentProps) {
  if (!order || !order.product_items) {
    return <p className="text-sm italic text-muted-foreground">[Error: Invalid order data]</p>;
  }
  
  const totalAmount = order.product_items.reduce((sum, item) => sum + (parseFloat(item.item_price) * parseInt(item.quantity)), 0);

  return (
    <div className="w-64">
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="p-2">
            <div className="flex items-center gap-2">
                 <IndianRupee className="h-5 w-5 text-primary"/>
                <CardTitle className="text-base">Order Details</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="p-2 space-y-2 text-xs">
          {order.product_items.map(item => (
            <div key={item.product_retailer_id} className="flex justify-between items-center">
              <div>
                <p className="font-medium">{item.product_retailer_id}</p>
                <p className="text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <span className="font-mono">{item.currency} {(parseFloat(item.item_price) * parseInt(item.quantity)).toFixed(2)}</span>
            </div>
          ))}
          <Separator className="my-2"/>
          <div className="flex justify-between items-center font-bold pt-1">
              <span>Total</span>
              <span>{order.product_items[0]?.currency} {totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
         {order.text && (
             <CardFooter className="p-2 text-xs text-muted-foreground border-t mt-2 pt-2">
                <p>{order.text}</p>
             </CardFooter>
         )}
      </Card>
    </div>
  );
}

    