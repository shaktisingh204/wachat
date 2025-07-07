

'use client';

import { Button } from '@/components/ui/button';
import { useCart } from '@/context/cart-context';
import type { EcommProduct, WithId } from '@/lib/definitions';
import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';

export function AddToCartButton({ product }: { product: WithId<EcommProduct> }) {
    const { addToCart } = useCart();
    const [quantity, setQuantity] = useState(1);

    const handleAddToCart = () => {
        addToCart({
            productId: product._id.toString(),
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            quantity: quantity,
        });
    };

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center border rounded-md">
                <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</Button>
                <span className="w-12 text-center">{quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => setQuantity(q => q + 1)}>+</Button>
            </div>
            <Button onClick={handleAddToCart} size="lg" className="flex-1">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart
            </Button>
        </div>
    );
}
