

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

interface PropertiesPanelProps {
    selectedBlock: WebsiteBlock | undefined;
    availableProducts: WithId<EcommProduct>[];
    onUpdate: (id: string, newSettings: any) => void;
    onRemove: (id: string) => void;
}

export function WebsiteBlockEditor({ selectedBlock, availableProducts, onUpdate, onRemove }: PropertiesPanelProps) {
    if (!selectedBlock) {
        return (
            <div className="text-center text-muted-foreground p-8">
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
            default:
                return <p className="text-sm text-muted-foreground">Editor not available for this block type.</p>
        }
    };
    
    return (
        <div>
            {renderEditor()}
        </div>
    );
}
