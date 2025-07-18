
'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { AddToCartButton } from './add-to-cart-button';

interface ProductBlockProps {
    product: WithId<EcommProduct> | null;
    settings: any;
}

const Placeholder = ({ text }: { text: string }) => (
    <div className="bg-muted p-4 text-center text-muted-foreground rounded-lg border-2 border-dashed">
        {text}
    </div>
);

export const ProductImageRenderer: React.FC<ProductBlockProps> = ({ product, settings }) => {
    if (!product) return <Placeholder text="Product Image" />;
    
    const style: React.CSSProperties = {
        objectFit: settings.objectFit || 'cover',
    };

    return (
        <div className="relative aspect-square">
            <Image 
                src={product.imageUrl || 'https://placehold.co/600x600.png'} 
                alt={product.name}
                fill
                style={style}
                data-ai-hint="product image"
            />
        </div>
    );
};

export const ProductTitleRenderer: React.FC<ProductBlockProps> = ({ product, settings }) => {
    if (!product) return <h1 className="text-3xl font-bold">Product Title</h1>;
    
    const alignment = settings.textAlign || 'left';
    const alignClass = `text-${alignment}`;
    
    return <h1 className={cn("text-3xl font-bold", alignClass)}>{product.name}</h1>;
};

export const ProductPriceRenderer: React.FC<ProductBlockProps> = ({ product, settings }) => {
    if (!product) return <p className="text-2xl text-primary font-semibold">$99.99</p>;

    const alignment = settings.textAlign || 'left';
    const alignClass = `text-${alignment}`;

    return (
        <p className={cn("text-2xl text-primary font-semibold", alignClass)}>
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)}
        </p>
    );
};

export const ProductDescriptionRenderer: React.FC<ProductBlockProps> = ({ product, settings }) => {
     if (!product) return (
        <div className="space-y-2">
            <p className="bg-muted h-4 w-full rounded-full"></p>
            <p className="bg-muted h-4 w-5/6 rounded-full"></p>
        </div>
     );

    const alignment = settings.textAlign || 'left';
    const alignClass = `text-${alignment}`;

    return <p className={cn("text-muted-foreground", alignClass)}>{product.description}</p>;
};

export const ProductAddToCartRenderer: React.FC<ProductBlockProps> = ({ product, settings }) => {
    if (!product) return (
         <div className="flex items-center gap-4">
            <div className="w-24 h-10 border rounded-md"></div>
            <Button size="lg" className="flex-1">Add to Cart</Button>
        </div>
    );
    return <AddToCartButton product={product} />;
};

export const ProductBreadcrumbsRenderer: React.FC<ProductBlockProps> = ({ product, settings }) => {
    const alignment = settings.textAlign || 'left';
    const alignClass = `justify-${alignment}`;

    return (
        <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", alignClass)}>
            <span>Home</span>
            <span>/</span>
            <span>Products</span>
            <span>/</span>
            <span className="text-foreground">{product?.name || 'Product'}</span>
        </div>
    );
};
