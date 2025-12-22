
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductMessageContentProps {
  catalogId: string;
  productRetailerId: string;
  isReply?: boolean; // To indicate if it's part of an interactive reply
}

export function ProductMessageContent({ catalogId, productRetailerId, isReply = false }: ProductMessageContentProps) {
  // In a real application, you would fetch product details using the IDs.
  // For this component, we'll just display the information we have.
  return (
    <div className={isReply ? "w-full" : "w-64"}>
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="p-2">
            <div className="flex items-center gap-2">
                 <ShoppingBag className="h-5 w-5 text-primary"/>
                <CardTitle className="text-base">Product Inquiry</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="p-2 space-y-1 text-xs">
          <p><span className="font-semibold">Product SKU:</span></p>
          <p className="font-mono text-muted-foreground bg-background rounded p-1">{productRetailerId}</p>
          {!isReply && (
            <>
              <p className="pt-2"><span className="font-semibold">From Catalog:</span></p>
              <p className="font-mono text-muted-foreground bg-background rounded p-1">{catalogId}</p>
            </>
          )}
        </CardContent>
        {!isReply && (
            <CardFooter className="p-2">
                <Button variant="outline" size="sm" className="w-full">View Product Details</Button>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}

    