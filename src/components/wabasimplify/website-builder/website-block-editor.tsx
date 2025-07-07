
'use client';

import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { HeroBlockEditor } from './hero-block-editor';
import { FeaturedProductsBlockEditor } from './featured-products-block-editor';
import { RichTextBlockEditor } from './rich-text-block-editor';
import { TestimonialsBlockEditor } from './testimonials-block-editor';
import { FaqBlockEditor } from './faq-block-editor';
import { CustomHtmlBlockEditor } from './custom-html-block-editor';
import { HeadingBlockEditor } from './heading-block-editor';
import { ImageBlockEditor } from './image-block-editor';
import { ButtonBlockEditor } from './button-block-editor';
import { VideoBlockEditor } from './video-block-editor';
import { IconBlockEditor } from './icon-block-editor';
import { SpacerBlockEditor } from './spacer-block-editor';
import { ImageCarouselBlockEditor } from './image-carousel-block-editor';
import { TabsBlockEditor } from './tabs-block-editor';
import { AccordionBlockEditor } from './accordion-block-editor';
import { FormBlockEditor } from './form-block-editor';
import { MapBlockEditor } from './map-block-editor';
import { CountdownBlockEditor } from './countdown-block-editor';
import { SocialShareBlockEditor } from './social-share-block-editor';
import { RepeaterBlockEditor } from './repeater-block-editor';
import { SectionBlockEditor } from './section-block-editor';
import { ColumnsBlockEditor } from './columns-block-editor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';


interface PropertiesPanelProps {
    selectedBlock: WebsiteBlock | undefined;
    availableProducts: WithId<EcommProduct>[];
    onUpdate: (id: string, newSettings: any) => void;
    onRemove: (id: string) => void;
}

export function WebsiteBlockEditor({ selectedBlock, availableProducts, onUpdate, onRemove }: PropertiesPanelProps) {
    if (!selectedBlock) {
        return (
            <div className="text-center text-muted-foreground p-8 h-full flex flex-col items-center justify-center">
                <p>Select a block on the canvas to edit its properties.</p>
            </div>
        );
    }

    const renderEditor = () => {
        switch (selectedBlock.type) {
            case 'hero':
                return <HeroBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'featuredProducts':
                return <FeaturedProductsBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} availableProducts={availableProducts} />;
            case 'richText':
                return <RichTextBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'testimonials':
                return <TestimonialsBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'faq':
                return <FaqBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'customHtml':
                return <CustomHtmlBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'heading':
                return <HeadingBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'image':
                return <ImageBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'button':
                return <ButtonBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'video':
                return <VideoBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'icon':
                return <IconBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'spacer':
                return <SpacerBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'imageCarousel':
                return <ImageCarouselBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'tabs':
                return <TabsBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'accordion':
                return <AccordionBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'form':
                return <FormBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'map':
                return <MapBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'countdown':
                return <CountdownBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'socialShare':
                return <SocialShareBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'repeater':
                return <RepeaterBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'section':
                return <SectionBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            case 'columns':
                return <ColumnsBlockEditor settings={selectedBlock.settings} onUpdate={(newSettings) => onUpdate(selectedBlock.id, newSettings)} />;
            default:
                return <p className="text-sm text-muted-foreground">Editor not available for this block type.</p>
        }
    };
    
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Block Properties</CardTitle>
                <CardDescription>Editing: <span className="font-semibold capitalize">{selectedBlock.type}</span></CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
                 {renderEditor()}
            </CardContent>
            <CardFooter className="border-t pt-4">
                <Button variant="destructive" className="w-full" onClick={() => onRemove(selectedBlock.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Block
                </Button>
            </CardFooter>
        </Card>
    );
}
