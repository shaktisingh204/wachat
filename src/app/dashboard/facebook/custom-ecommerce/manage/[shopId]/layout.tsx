"use client";

import { Alert, ZoruAlertDescription, ZoruAlertTitle, Button, Skeleton, useZoruToast } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import Link from "next/link";
import { useParams,
  usePathname,
  useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Brush,
  LoaderCircle,
  Package,
  Settings,
  ShoppingBag,
  Wand,
  } from "lucide-react";

import {
  applyEcommShopTheme,
  getEcommShopById,
  } from "@/app/actions/custom-ecommerce.actions";
import type { EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/layout.tsx
 *
 * Per-shop scope wrap. Loads the active shop, renders a zoru page-header
 * with shop name + apply-default-theme action, and a route-driven sub-page
 * nav using `Button variant="default|outline"` (NOT tabs — per the
 * design directive).
 *
 * The website-builder route is exempt: it renders its own full-bleed
 * canvas chrome and skips this layout's frame.
 */

import * as React from "react";

import {
  ShopBreadcrumb,
  ShopHeader,
  ShopPage,
  ShopSubNav,
  type ShopSubNavItem,
} from "../../_components/shop-shell";

const NAV_ITEMS: ShopSubNavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/website-builder", label: "Website builder", icon: Brush },
  { href: "/products", label: "Products", icon: ShoppingBag },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/flow-builder", label: "Chat bot", icon: Bot },
];

function LayoutSkeleton() {
  return (
    <ShopPage>
      <ZoruSkeleton className="h-3 w-72" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-2">
          <ZoruSkeleton className="h-8 w-72" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <ZoruSkeleton className="h-9 w-44" />
      </div>
      <ZoruSkeleton className="mt-6 h-10 w-full" />
      <ZoruSkeleton className="mt-6 h-64 w-full" />
    </ShopPage>
  );
}

export default function ShopManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useZoruToast();
  const shopId = params?.shopId as string | undefined;
  const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingTheme, startThemeTransition] = useTransition();

  useEffect(() => {
    if (!shopId) return;
    getEcommShopById(shopId)
      .then((data) => {
        setShop(data);
      })
      .finally(() => setIsLoading(false));
  }, [shopId]);

  const isWebsiteBuilderPage = pathname?.includes("/website-builder") ?? false;

  // Website builder owns its own chrome — pass through.
  if (isWebsiteBuilderPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <LayoutSkeleton />;
  }

  if (!shop) {
    return (
      <ShopPage>
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Shop not found</ZoruAlertTitle>
          <ZoruAlertDescription>
            The requested shop could not be loaded.
          </ZoruAlertDescription>
        </ZoruAlert>
        <div className="mt-4">
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/facebook/custom-ecommerce">
              <ArrowLeft />
              Back to all shops
            </Link>
          </ZoruButton>
        </div>
      </ShopPage>
    );
  }

  const handleApplyTheme = () => {
    startThemeTransition(async () => {
      const result = await applyEcommShopTheme(shop._id.toString());
      if (result.error) {
        toast({
          title: "Could not apply theme",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Theme applied",
          description: result.message,
        });
        router.refresh();
      }
    });
  };

  const basePath = `/dashboard/facebook/custom-ecommerce/manage/${shopId}`;
  // Derive a friendly leaf label for the breadcrumb based on the active path.
  const leafFromPath = ((): string | undefined => {
    if (!pathname) return undefined;
    if (pathname === basePath) return undefined;
    const tail = pathname.slice(basePath.length);
    const match = NAV_ITEMS.find(
      (item) => tail === item.href || tail.startsWith(`${item.href}/`),
    );
    if (match) {
      if (tail === `${match.href}/docs`) return `${match.label} · Docs`;
      if (tail.startsWith(`${match.href}/`)) return match.label;
      return match.label;
    }
    if (tail === "/appearance") return "Appearance";
    return undefined;
  })();

  return (
    <ShopPage>
      <ShopBreadcrumb
        shopId={shop._id.toString()}
        shopName={shop.name}
        leaf={leafFromPath}
      />

      <ShopHeader
        className="mt-5"
        eyebrow="Custom Shops"
        title={shop.name}
        description="Manage your custom e-commerce shop."
        actions={
          <>
            <ZoruButton variant="ghost" asChild>
              <Link href="/dashboard/facebook/custom-ecommerce">
                <ArrowLeft />
                All shops
              </Link>
            </ZoruButton>
            <ZoruButton
              variant="outline"
              onClick={handleApplyTheme}
              disabled={isApplyingTheme}
            >
              {isApplyingTheme ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Wand />
              )}
              Apply default theme
            </ZoruButton>
          </>
        }
      />

      <ShopSubNav
        items={NAV_ITEMS}
        pathname={pathname ?? ""}
        basePath={basePath}
      />

      <div className="mt-6">{children}</div>
    </ShopPage>
  );
}
