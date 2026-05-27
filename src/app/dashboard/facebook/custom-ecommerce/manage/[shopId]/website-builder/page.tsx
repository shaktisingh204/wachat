import { cn } from '@/components/zoruui';
import {
  notFound } from "next/navigation";

import {
  getEcommPages,
  getEcommProducts,
  getEcommShopById,
  } from "@/app/actions/custom-ecommerce.actions";
import { CartProvider } from "@/context/cart-context";
import { WebsiteBuilder } from "@/components/zoruui-domain/website-builder/website-builder";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/website-builder
 *
 * Visual page-builder shell. The parent layout passes through (no chrome)
 * for this route, so the heavy canvas owns the viewport. We render only
 * the data fetch + a thin zoru breadcrumb above the WebsiteBuilder.
 *
 * TODO(meta-zoru phase 7): the existing `WebsiteBuilder` canvas at
 * `@/components/zoruui-domain/website-builder` is treated as an opaque
 * internal — the canvas + block library + render runtime are too large
 * to migrate as part of this phase. A follow-up batch should rebuild
 * the surrounding chrome (toolbar, save bar, sidebar) on top of zoru
 * primitives. The CartProvider is required by the runtime; we leave it
 * untouched.
 */

export const dynamic = "force-dynamic";

export default async function WebsiteBuilderPage(props: {
  params: Promise<{ shopId: string }>;
}) {
  const params = await props.params;
  const [shop, pages, products] = await Promise.all([
    getEcommShopById(params.shopId),
    getEcommPages(params.shopId),
    getEcommProducts(params.shopId),
  ]);

  if (!shop) {
    notFound();
  }

  return (
    <CartProvider>
      <div className={cn("zoruui")}>
        <WebsiteBuilder
          shop={shop}
          initialPages={pages}
          availableProducts={products}
        />
      </div>
    </CartProvider>
  );
}
