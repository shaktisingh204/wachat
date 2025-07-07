
'use client';

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import type { WithId, EcommProduct, WebsiteBlock } from '@/lib/definitions';
import { HeroBlockEditor } from './hero-block-editor';
import { FeaturedProductsBlockEditor } from './featured-products-block-editor';
import { RichTextBlockEditor } from './rich-text-block-editor';
import { TestimonialsBlockEditor } from './testimonials-block-editor';
import { FaqBlockEditor } from './faq-block-editor';
import { CustomHtmlBlockEditor } from './custom-html-block-editor';
import { HeadingBlockEditor } from './heading-block-editor';
import { ImageBlockEditor } from './image-block-editor';
import { cn } from "@/lib/utils";

interface WebsiteBlockEditorProps {
    block: WebsiteBlock;
    onUpdate: (id: string, newSettings: any) => void;
    onRemove: (id: string) => void;
    availableProducts: WithId<EcommProduct>[];
    isDragging: boolean;
}

export function WebsiteBlockEditor({ block, onUpdate, onRemove, availableProducts, isDragging }: WebsiteBlockEditorProps) {

    const handleSettingsUpdate = (newSettings: any) => {
        onUpdate(block.id, newSettings);
    };

    const renderEditor = () => {
        switch (block.type) {
            case 'hero':
                return <HeroBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            case 'featuredProducts':
                return <FeaturedProductsBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} availableProducts={availableProducts} />;
            case 'richText':
                return <RichTextBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            case 'testimonials':
                return <TestimonialsBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            case 'faq':
                return <FaqBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            case 'customHtml':
                return <CustomHtmlBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            case 'heading':
                return <HeadingBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            case 'image':
                return <ImageBlockEditor settings={block.settings} onUpdate={handleSettingsUpdate} />;
            default:
                return <p className="text-sm text-muted-foreground">Editor not available for this block type.</p>
        }
    };

    return (
        <div className={cn("bg-card rounded-lg border", isDragging && "shadow-2xl ring-2 ring-primary")}>
            <CardHeader className="flex flex-row items-center justify-between p-3 bg-muted/50 rounded-t-lg border-b cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{block.type.replace(/([A-Z])/g, ' $1').trim()}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(block.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardHeader>
            <CardContent className="p-4">
                {renderEditor()}
            </CardContent>
        </div>
    );
}
