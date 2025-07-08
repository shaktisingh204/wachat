
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SurfaceSwitcher } from './surface-switcher';
import { Eye, Save, ArrowLeft, LoaderCircle } from 'lucide-react';
import type { WithId, EcommShop, EcommPage } from '@/lib/definitions';

interface WebsiteBuilderHeaderProps {
  shop: WithId<EcommShop>;
  pages: WithId<EcommPage>[];
  activeSurface: string;
  isSaving: boolean;
  onSwitchSurface: (surface: string) => void;
  onSave: () => void;
}

export function WebsiteBuilderHeader({
  shop,
  pages,
  activeSurface,
  isSaving,
  onSwitchSurface,
  onSave,
}: WebsiteBuilderHeaderProps) {
  return (
    <header className="flex-shrink-0 flex items-center justify-between gap-4 p-3 border-b bg-background">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/facebook/custom-ecommerce/manage/${shop._id.toString()}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <SurfaceSwitcher
          shop={shop}
          pages={pages}
          activeSurface={activeSurface}
          onSwitch={onSwitchSurface}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <Link href={`/shop/${shop.slug}`} target="_blank">
            <Eye className="mr-2 h-4 w-4" />
            View Site
          </Link>
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>
    </header>
  );
}
