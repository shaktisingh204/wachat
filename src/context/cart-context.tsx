

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { EcommCartItem } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

interface CartContextType {
  cart: EcommCartItem[];
  addToCart: (item: EcommCartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<EcommCartItem[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const storedCart = localStorage.getItem('ecomm_cart');
            if (storedCart) {
                setCart(JSON.parse(storedCart));
            }
        } catch (error) {
            console.error("Failed to parse cart from localStorage", error);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('ecomm_cart', JSON.stringify(cart));
        } catch (error) {
            console.error("Failed to save cart to localStorage", error);
        }
    }, [cart]);

    const addToCart = (newItem: EcommCartItem) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.productId === newItem.productId);
            if (existingItem) {
                return prevCart.map(item =>
                    item.productId === newItem.productId
                        ? { ...item, quantity: item.quantity + newItem.quantity }
                        : item
                );
            }
            return [...prevCart, newItem];
        });
        toast({ title: `${newItem.name} added to cart!` });
    };

    const removeFromCart = (productId: string) => {
        setCart(prevCart => prevCart.filter(item => item.productId !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(productId);
            return;
        }
        setCart(prevCart =>
            prevCart.map(item =>
                item.productId === productId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = () => {
        setCart([]);
    };

    const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, itemCount, cartTotal }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
