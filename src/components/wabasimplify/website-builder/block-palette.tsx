
'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Type, Image as ImageIcon, Star, MessageSquareText, FileQuestion, Code, ShoppingBag, LayoutDashboard } from 'lucide-react';
import type { WebsiteBlock } from '@/lib/definitions';

const blockTypes = [
    { type: 'hero', label: 'Hero Section', icon: LayoutDashboard },
    { type: 'featuredProducts', label: 'Featured Products', icon: ShoppingBag },
    { type: 'richText', label: 'Rich Text', icon: Type },
    { type: 'testimonials', label: 'Testimonials', icon: Star },
    { type: 'faq', label: 'FAQ', icon: FileQuestion },
    { type: 'customHtml', label: 'Custom HTML', icon: Code },
];

interface BlockPaletteProps {
    onAddBlock: (type: WebsiteBlock['type']) => void;
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Blocks</h2>
            <div className="space-y-2">
                {blockTypes.map(block => (
                    <Button key={block.type} variant="outline" className="w-full justify-start" onClick={() => onAddBlock(block.type as WebsiteBlock['type'])}>
                        <block.icon className="mr-2 h-4 w-4" />
                        {block.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
