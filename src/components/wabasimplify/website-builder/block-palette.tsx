

'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Type, Star, FileQuestion, Code, ShoppingBag, LayoutDashboard, Heading1, Image as ImageIcon, MousePointerClick, Video, Star as StarIcon } from 'lucide-react';
import type { WebsiteBlock } from '@/lib/definitions';

const blockSections = [
    {
        title: 'Pre-made Sections',
        blocks: [
            { type: 'hero', label: 'Hero Section', icon: LayoutDashboard },
            { type: 'featuredProducts', label: 'Featured Products', icon: ShoppingBag },
            { type: 'testimonials', label: 'Testimonials', icon: Star },
            { type: 'faq', label: 'FAQ', icon: FileQuestion },
        ]
    },
    {
        title: 'Custom Blocks',
        blocks: [
            { type: 'heading', label: 'Heading', icon: Heading1 },
            { type: 'richText', label: 'Rich Text', icon: Type },
            { type: 'image', label: 'Image', icon: ImageIcon },
            { type: 'button', label: 'Button', icon: MousePointerClick },
            { type: 'video', label: 'Video', icon: Video },
            { type: 'icon', label: 'Icon', icon: StarIcon },
            { type: 'customHtml', label: 'Custom HTML', icon: Code },
        ]
    }
];


interface BlockPaletteProps {
    onAddBlock: (type: WebsiteBlock['type']) => void;
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Blocks</h2>
            <div className="space-y-6">
                {blockSections.map((section, sectionIndex) => (
                    <div key={section.title} className="space-y-2">
                        <h3 className="font-semibold text-sm text-muted-foreground px-2">{section.title}</h3>
                        {section.blocks.map(block => (
                            <Button key={block.type} variant="outline" className="w-full justify-start" onClick={() => onAddBlock(block.type as WebsiteBlock['type'])}>
                                <block.icon className="mr-2 h-4 w-4" />
                                {block.label}
                            </Button>
                        ))}
                        {sectionIndex < blockSections.length - 1 && <Separator className="my-4" />}
                    </div>
                ))}
            </div>
        </div>
    );
}
