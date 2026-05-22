'use client';

import { Card, ZoruCardContent, ZoruCardDescription, ZoruCardFooter, ZoruCardHeader, ZoruCardTitle, Button } from '@/components/zoruui';
import { ShoppingBag } from 'lucide-react';

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
        <ZoruCardHeader className="p-2">
            <div className="flex items-center gap-2">
                 <ShoppingBag className="h-5 w-5 text-primary"/>
                <ZoruCardTitle className="text-base">Product Inquiry</ZoruCardTitle>
            </div>
        </ZoruCardHeader>
        <ZoruCardContent className="p-2 space-y-1 text-xs">
          <p><span className="font-semibold">Product SKU:</span></p>
          <p className="font-mono text-muted-foreground bg-background rounded p-1">{productRetailerId}</p>
          {!isReply && (
            <>
              <p className="pt-2"><span className="font-semibold">From Catalog:</span></p>
              <p className="font-mono text-muted-foreground bg-background rounded p-1">{catalogId}</p>
            </>
          )}
        </ZoruCardContent>
        {!isReply && (
            <ZoruCardFooter className="p-2">
                <Button variant="outline" size="sm" className="w-full">View Product Details</Button>
            </ZoruCardFooter>
        )}
      </Card>
    </div>
  );
}

    