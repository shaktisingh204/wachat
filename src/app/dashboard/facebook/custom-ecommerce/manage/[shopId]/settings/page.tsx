"use client";

import { Alert, ZoruAlertDescription, ZoruAlertTitle, Separator, Skeleton } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { getEcommShopById } from "@/app/actions/custom-ecommerce.actions";
import { getCustomDomains } from "@/app/actions/url-shortener.actions";
import type { CustomDomain,
  EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/settings
 *
 * Per-shop settings — three stacked zoru cards (basic settings + payment +
 * abandoned cart, persistent menu, custom domain). All form components
 * are local zoru replacements with the same server actions wired in.
 */

import * as React from "react";

import { EcommCustomDomainForm } from "../../../_components/ecomm-custom-domain-form";
import { EcommSettingsForm } from "../../../_components/ecomm-settings-form";
import { PersistentMenuForm } from "../../../_components/persistent-menu-form";

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export default function SettingsPage() {
  const params = useParams();
  const shopId = params?.shopId as string | undefined;
  const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
  const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !shopId) return;
    startLoadingTransition(async () => {
      const [shopData, domainData] = await Promise.all([
        getEcommShopById(shopId),
        getCustomDomains(),
      ]);
      setShop(shopData);
      setDomains(domainData);
    });
  }, [isClient, shopId]);

  if (isLoading || !isClient) {
    return <PageSkeleton />;
  }

  if (!shop) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Shop not found</ZoruAlertTitle>
        <ZoruAlertDescription>
          The requested shop could not be loaded.
        </ZoruAlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EcommSettingsForm shop={shop} domains={domains} />
      <Separator />
      <PersistentMenuForm shop={shop} />
      <Separator />
      <EcommCustomDomainForm />
    </div>
  );
}
