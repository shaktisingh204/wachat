'use client';

import { Label, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  useRouter,
  usePathname } from 'next/navigation';

/**
 * Small client filter island — routes to the same page with the new
 * `?storefrontId=` value. Used at the top of the products / pricing /
 * shipping list pages so the rest of those pages stay 100% server.
 */

export interface StorefrontFilterClientProps {
    storefronts: Array<{ id: string; name: string }>;
    selectedId?: string;
}

const ALL_VALUE = '__ALL__';

export function StorefrontFilterClient({
    storefronts,
    selectedId,
}: StorefrontFilterClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const currentValue = selectedId && selectedId.length > 0 ? selectedId : ALL_VALUE;

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="storefront-filter">Storefront</Label>
                <Select
                    value={currentValue}
                    onValueChange={(value) => {
                        if (value === ALL_VALUE) {
                            router.push(pathname);
                            return;
                        }
                        router.push(`${pathname}?storefrontId=${value}`);
                    }}
                >
                    <ZoruSelectTrigger
                        id="storefront-filter"
                        className="w-[260px]"
                    >
                        <ZoruSelectValue placeholder="All storefronts" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value={ALL_VALUE}>
                            All storefronts
                        </ZoruSelectItem>
                        {storefronts.map((sf) => (
                            <ZoruSelectItem key={sf.id} value={sf.id}>
                                {sf.name}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>
        </div>
    );
}
