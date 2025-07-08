
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { ChevronsUpDown, Check, LayoutTemplate, File, ShoppingCart } from 'lucide-react';
import type { WithId, EcommPage, EcommShop } from '@/lib/definitions';

interface SurfaceSwitcherProps {
  shop: WithId<EcommShop>;
  pages: WithId<EcommPage>[];
  activeSurface: string;
  onSwitch: (surface: string) => void;
}

export function SurfaceSwitcher({ shop, pages, activeSurface, onSwitch }: SurfaceSwitcherProps) {
    const siteParts = [
        { id: 'header', name: 'Header' },
        { id: 'footer', name: 'Footer' },
        { id: 'productPage', name: 'Single Product Template' },
        { id: 'cartPage', name: 'Cart Page Template' },
    ];
    
    const allPages = pages.sort((a,b) => (b.isHomepage ? 1 : 0) - (a.isHomepage ? 1 : 0));
    
    const activeSurfaceLabel =
        siteParts.find(p => p.id === activeSurface)?.name ||
        allPages.find(p => p._id.toString() === activeSurface)?.name ||
        'Select a Page';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-56 justify-between">
                    <span className="truncate">{activeSurfaceLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Site Parts</DropdownMenuLabel>
                <DropdownMenuGroup>
                    {siteParts.map(part => (
                        <DropdownMenuItem key={part.id} onSelect={() => onSwitch(part.id)}>
                             <LayoutTemplate className="mr-2 h-4 w-4" />
                            <span>{part.name}</span>
                            {activeSurface === part.id && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Pages</DropdownMenuLabel>
                 <DropdownMenuGroup>
                    {allPages.map(page => (
                         <DropdownMenuItem key={page._id.toString()} onSelect={() => onSwitch(page._id.toString())}>
                             <File className="mr-2 h-4 w-4" />
                            <span>{page.name}</span>
                             {activeSurface === page._id.toString() && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
