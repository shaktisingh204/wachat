"use client";

import { Skeleton } from '@/components/zoruui';
import {
  useEffect } from "react";
import { useParams,
  useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId] — index redirect.
 *
 * The shop scope has no "overview" page — the layout's sub-nav drives users
 * straight into a leaf. We redirect to /settings (the most useful default).
 */

export default function ShopManageIndexPage() {
  const router = useRouter();
  const params = useParams();
  const shopId = params?.shopId as string | undefined;

  useEffect(() => {
    if (shopId) {
      router.replace(
        `/dashboard/facebook/custom-ecommerce/manage/${shopId}/settings`,
      );
    } else {
      router.replace("/dashboard/facebook/custom-ecommerce");
    }
  }, [router, shopId]);

  return (
    <div className="flex items-center gap-3 py-12 text-zoru-ink-muted">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <p className="text-[13px]">Redirecting to shop settings…</p>
      <ZoruSkeleton className="h-4 w-40" />
    </div>
  );
}
