
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

export function ProductCard({ product, shopSlug }: { product: any, shopSlug: string }) {
  return (
    <Link href={`/shop/${shopSlug}/product/${product._id.toString()}`} className="group">
      <Card className="overflow-hidden h-full flex flex-col transition-all group-hover:shadow-lg">
        <CardHeader className="p-0">
          <div className="relative aspect-square bg-muted">
            <Image
              src={product.imageUrl || 'https://placehold.co/400x400.png'}
              alt={product.name}
              layout="fill"
              objectFit="cover"
              className="transition-transform group-hover:scale-105"
              data-ai-hint="product photo"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-grow flex flex-col">
          <h3 className="font-semibold text-base flex-grow">{product.name}</h3>
          <div className="flex justify-between items-center mt-2">
            <p className="text-lg font-bold text-primary">
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
              }).format(product.price)}
            </p>
            <Button size="icon" variant="ghost">
              <ShoppingCart className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
