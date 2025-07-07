
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import type { WithId, EcommProduct, WebsiteBlock } from '@/lib/definitions';
import { HeroBlockEditor } from './hero-block-editor';
import { FeaturedProductsBlockEditor } from './featured-products-block-editor';
import { RichTextBlockEditor } from './rich-text-block-editor';
import { TestimonialsBlockEditor } from './testimonials-block-editor';
import { FaqBlockEditor } from './faq-block-editor';
import { CustomHtmlBlockEditor } from './custom-html-block-editor';

interface WebsiteBlockEditorProps {
    block: WebsiteBlock;
    onUpdate: (id: string, newSettings: any) => void;
    onRemove: (id: string) => void;
    availableProducts: WithId<EcommProduct>[];
}

export function WebsiteBlockEditor({ block, onUpdate, onRemove, availableProducts }: WebsiteBlockEditorProps) {

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
            default:
                return <p className="text-sm text-muted-foreground">Editor not available for this block type.</p>
        }
    };

    return (
        <Card className="bg-background">
            <CardHeader className="flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <div>
                        <CardTitle className="text-base">{block.type.replace(/([A-Z])/g, ' $1').trim()}</CardTitle>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(block.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {renderEditor()}
            </CardContent>
        </Card>
    );
}
