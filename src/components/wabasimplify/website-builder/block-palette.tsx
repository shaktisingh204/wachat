

'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Type, Star, FileQuestion, Code, ShoppingBag, LayoutDashboard, Heading1, Image as ImageIcon, MousePointerClick, Video, Star as StarIcon, Minus, GalleryVertical, Rows as TabsIcon, PanelTopClose, ClipboardList, MapPin, Timer, Share2, Repeat, LayoutGrid, ShoppingCart as CartIcon, Zap } from 'lucide-react';
import type { WebsiteBlock } from '@/lib/definitions';

const blockSections = [
    {
        title: 'Layout',
        blocks: [
            { type: 'section', label: 'Section / Container', icon: LayoutDashboard },
            { type: 'columns', label: 'Columns', icon: LayoutGrid },
            { type: 'tabs', label: 'Tabs', icon: TabsIcon },
            { type: 'accordion', label: 'Accordion', icon: PanelTopClose },
            { type: 'spacer', label: 'Spacer / Divider', icon: Minus },
        ]
    },
    {
        title: 'Content Blocks',
        blocks: [
            { type: 'heading', label: 'Heading', icon: Heading1 },
            { type: 'richText', label: 'Rich Text', icon: Type },
            { type: 'image', label: 'Image', icon: ImageIcon },
            { type: 'video', label: 'Video', icon: Video },
            { type: 'imageCarousel', label: 'Image Carousel', icon: GalleryVertical },
            { type: 'button', label: 'Button', icon: MousePointerClick },
            { type: 'icon', label: 'Icon', icon: StarIcon },
            { type: 'countdown', label: 'Countdown Timer', icon: Timer },
            { type: 'socialShare', label: 'Social Share', icon: Share2 },
        ]
    },
    {
        title: 'Pre-made Sections',
        blocks: [
            { type: 'hero', label: 'Hero Section', icon: LayoutDashboard },
            { type: 'featuredProducts', label: 'Featured Products', icon: ShoppingBag },
            { type: 'testimonials', label: 'Testimonials', icon: Star },
            { type: 'faq', label: 'FAQ', icon: FileQuestion },
            { type: 'repeater', label: 'Repeater', icon: Repeat },
        ]
    },
    {
        title: 'Shop',
        blocks: [
            { type: 'cart', label: 'Cart', icon: CartIcon },
        ]
    },
    {
        title: 'Advanced',
        blocks: [
            { type: 'form', label: 'Form', icon: ClipboardList },
            { type: 'map', label: 'Map', icon: MapPin },
            { type: 'customHtml', label: 'Custom HTML', icon: Code },
            { type: 'crmAutomation', label: 'CRM Automation', icon: Zap },
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
                            <Button key={block.type} variant="outline" className="w-full justify-start mb-2" onClick={() => onAddBlock(block.type as WebsiteBlock['type'])}>
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
