
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee } from 'lucide-react';
import Image from 'next/image';

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
              <span>{item.product_retailer_id} x{item.quantity}</span>
              <span>{item.currency} {item.item_price}</span>
            </div>
          ))}
          <div className="flex justify-between items-center font-bold pt-2 border-t">
              <span>Total</span>
              <span>{order.product_items[0]?.currency} {totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
         {order.text && (
             <CardFooter className="p-2 text-xs text-muted-foreground">
                <p>{order.text}</p>
             </CardFooter>
         )}
      </Card>
    </div>
  );
}
