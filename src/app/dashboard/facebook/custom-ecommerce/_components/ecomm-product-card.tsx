"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  Edit,
  Trash2 } from "lucide-react";

import { deleteEcommProduct } from "@/app/actions/custom-ecommerce.actions";
import type { EcommProduct,
  EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * Zoru-only replacement for `@/components/wabasimplify/ecomm-product-card`.
 *
 * Same data shape and same `deleteEcommProduct` server action — visuals are
 * rebuilt with ZoruCard, ZoruBadge, ZoruButton, and ZoruAlertDialog.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

interface EcommProductCardProps {
  product: WithId<EcommProduct>;
  shopSettings: WithId<EcommShop> | null;
  onEdit: () => void;
  onDelete: () => void;
  shopSlug?: string;
}

export function EcommProductCard({
  product,
  shopSettings,
  onEdit,
  onDelete,
  shopSlug,
}: EcommProductCardProps) {
  const { toast } = useZoruToast();

  const handleDelete = async () => {
    const result = await deleteEcommProduct(product._id.toString());
    if (result.success) {
      toast({ title: "Product deleted" });
      onDelete();
    } else {
      toast({
        title: "Could not delete",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const currency = shopSettings?.currency || "USD";

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (shopSlug) {
      return (
        <Link
          href={`/shop/${shopSlug}/product/${product._id.toString()}`}
          className="group flex flex-1 flex-col"
        >
          {children}
        </Link>
      );
    }
    return <div className="flex flex-1 flex-col">{children}</div>;
  };

  const stock = product.stock ?? 0;
  const inStock = stock > 0;

  return (
    <ZoruCard className="flex flex-col overflow-hidden p-0">
      <Wrapper>
        <ZoruCardHeader className="p-0">
          <div className="relative aspect-[4/5] bg-zoru-surface-2">
            <Image
              src={product.imageUrl || "https://placehold.co/400x500.png"}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 100vw"
            />
          </div>
          <div className="p-4 pb-0">
            <ZoruCardTitle className="text-[16px] tracking-tight">
              {product.name}
            </ZoruCardTitle>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="flex-1 px-4 pb-4 pt-2">
          <p className="line-clamp-2 h-10 text-[13px] text-zoru-ink-muted">
            {product.description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[15px] tracking-tight text-zoru-ink">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
              }).format(product.price)}
            </p>
            <ZoruBadge variant={inStock ? "default" : "danger"}>
              {inStock ? `${stock} in stock` : "Out of stock"}
            </ZoruBadge>
          </div>
        </ZoruCardContent>
      </Wrapper>
      <ZoruCardFooter className="flex justify-end gap-2 border-t border-zoru-line p-4">
        <ZoruButton variant="outline" size="sm" onClick={onEdit}>
          <Edit />
          Edit
        </ZoruButton>
        <ZoruAlertDialog>
          <ZoruAlertDialogTrigger asChild>
            <ZoruButton variant="destructive" size="sm">
              <Trash2 />
              Delete
            </ZoruButton>
          </ZoruAlertDialogTrigger>
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Delete product?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                This will permanently delete &ldquo;{product.name}&rdquo;.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction onClick={handleDelete}>
                Delete
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>
      </ZoruCardFooter>
    </ZoruCard>
  );
}
