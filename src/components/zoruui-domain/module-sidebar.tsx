'use client';

import { Button } from '@/components/zoruui';
import { cn } from '@/lib/utils';

import React from 'react';
import Link from 'next/link';

import { usePathname } from 'next/navigation';

export interface ModuleSidebarItem {
    label: string;
    href?: string; // For route-based navigation
    value?: string; // For state-based navigation
    icon?: React.ElementType;
    badge?: number | string;
}

interface ModuleSidebarProps {
    items: ModuleSidebarItem[];
    // For state-based control
    activeValue?: string;
    onValueChange?: (value: string) => void;
    title?: string;
}

export function ModuleSidebar({ items, activeValue, onValueChange, title }: ModuleSidebarProps) {
    const pathname = usePathname();

    return (
        <nav className="flex flex-col gap-2">
            {title && (
                <div className="px-4 py-2 mb-2">
                    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                </div>
            )}
            {items.map((item) => {
                const isActive = item.href
                    ? pathname === item.href
                    : activeValue === item.value;

                const content = (
                    <>
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                            <span className="ml-auto text-xs bg-zoru-ink/10 text-zoru-ink px-2 py-0.5 rounded-full">
                                {item.badge}
                            </span>
                        )}
                    </>
                );

                if (item.href) {
                    return (
                        <Button
                            key={item.href}
                            variant={isActive ? "secondary" : "ghost"}
                            className={cn("justify-start w-full", isActive && "bg-zoru-surface-2 font-medium")}
                            asChild
                        >
                            <Link href={item.href}>
                                {content}
                            </Link>
                        </Button>
                    );
                }

                return (
                    <Button
                        key={item.value}
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn("justify-start w-full", isActive && "bg-zoru-surface-2 font-medium")}
                        onClick={() => onValueChange?.(item.value!)}
                    >
                        {content}
                    </Button>
                );
            })}
        </nav>
    );
}
