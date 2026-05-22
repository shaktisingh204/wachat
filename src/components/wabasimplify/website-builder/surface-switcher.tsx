'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuGroup,
  Select,
} from '@/components/zoruui';
import * as React from 'react';

import { ChevronsUpDown, Check, LayoutTemplate, File, ShoppingCart } from 'lucide-react';
import type { WithId, EcommPage, EcommShop, Website, WebsitePage } from '@/lib/definitions';

interface SurfaceSwitcherProps {
    shop: WithId<EcommShop | Website>;
    pages: WithId<EcommPage | WebsitePage>[];
    activeSurface: string;
    onSwitch: (surface: string) => void;
}

export function SurfaceSwitcher({ shop, pages, activeSurface, onSwitch }: SurfaceSwitcherProps) {
    const siteParts = [
        { id: 'header', name: 'Header' },
        { id: 'footer', name: 'Footer' },
        { id: 'productPage', name: 'Single Product Template' },
        { id: 'productsPage', name: 'All Products Template' },
        { id: 'categoryPage', name: 'Category Page Template' },
        { id: 'searchPage', name: 'Search Results Template' },
        { id: 'cartPage', name: 'Cart Page Template' },
    ];

    const allPages = pages.sort((a, b) => (b.isHomepage ? 1 : 0) - (a.isHomepage ? 1 : 0));

    const activeSurfaceLabel =
        siteParts.find(p => p.id === activeSurface)?.name ||
        allPages.find(p => p._id.toString() === activeSurface)?.name ||
        'Select a Page';

    return (
        <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" className="w-56 justify-between">
                    <span className="truncate">{activeSurfaceLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent className="w-56">
                <ZoruDropdownMenuLabel>Site Parts</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuGroup>
                    {siteParts.map(part => (
                        <ZoruDropdownMenuItem key={part.id} onSelect={() => onSwitch(part.id)}>
                            <LayoutTemplate className="mr-2 h-4 w-4" />
                            <span>{part.name}</span>
                            {activeSurface === part.id && <Check className="ml-auto h-4 w-4" />}
                        </ZoruDropdownMenuItem>
                    ))}
                </ZoruDropdownMenuGroup>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuLabel>Pages</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuGroup>
                    {allPages.map(page => (
                        <ZoruDropdownMenuItem key={page._id.toString()} onSelect={() => onSwitch(page._id.toString())}>
                            <File className="mr-2 h-4 w-4" />
                            <span>{page.name}</span>
                            {activeSurface === page._id.toString() && <Check className="ml-auto h-4 w-4" />}
                        </ZoruDropdownMenuItem>
                    ))}
                </ZoruDropdownMenuGroup>
            </ZoruDropdownMenuContent>
        </ZoruDropdownMenu>
    );
}
