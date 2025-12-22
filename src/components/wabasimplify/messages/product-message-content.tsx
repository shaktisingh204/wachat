
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

interface ProductMessageContentProps {
  catalogId: string;
  productRetailerId: string;
}

export function ProductMessageContent({ catalogId, productRetailerId }: ProductMessageContentProps) {
  // In a real application, you would fetch product details using the IDs.
  // For this component, we'll just display the information we have.
  return (
    <div className="w-64">
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="p-2">
            <div className="flex items-center gap-2">
                 <ShoppingBag className="h-5 w-5 text-primary"/>
                <CardTitle className="text-base">Product Inquiry</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="p-2 space-y-1 text-xs">
          <p><span className="font-semibold">Product SKU:</span> {productRetailerId}</p>
          <p><span className="font-semibold">From Catalog:</span> {catalogId}</p>
        </CardContent>
      </Card>
    </div>
  );
}
