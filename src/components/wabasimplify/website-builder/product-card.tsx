'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import type { WithId, EcommProduct, EcommShop } from '@/lib/definitions';
import { useCart } from '@/context/cart-context';

export function ProductCard({ product, shopSettings, shopSlug }: { product: WithId<EcommProduct>, shopSettings: WithId<EcommShop> | null, shopSlug: string }) {
  const currency = shopSettings?.currency || 'USD';
  const { addToCart } = useCart();
  
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product._id.toString(),
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: 1
    });
  }

  return (
     Link href={`/shop/${shopSlug}/product/${product._id.toString()}`} className="group block"
       Card className="overflow-hidden h-full flex flex-col transition-all group-hover:shadow-lg"
        div className="relative aspect-[4/5] bg-muted"
          Image
            src={product.imageUrl || 'https://placehold.co/400x500.png'}
            alt={product.name}
            layout="fill"
            objectFit="cover"
            className="transition-transform group-hover:scale-105"
            data-ai-hint="product photo"
          /
        div
        CardContent className="p-4 flex-grow flex flex-col justify-between"
            div
                h3 className="font-semibold text-base line-clamp-2"{product.name}/h3
                p className="text-sm text-muted-foreground"{product.category || 'Uncategorized'}/p
            div
            div className="flex justify-between items-center mt-2"
                p className="text-lg font-bold text-primary"
                {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                }).format(product.price)}
                /p
                 Button size="sm" variant="outline" onClick={handleAddToCart}
                    ShoppingCart className="mr-2 h-4 w-4" /
                    Add
                Button
            div
        CardContent
      Card
    Link
  );
}
