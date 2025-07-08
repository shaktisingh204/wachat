
'use client';

import React from 'react';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { HeroBlockEditor } from './hero-block-editor';
import { FeaturedProductsBlockEditor } from './featured-products-block-editor';
import { RichTextBlockEditor } from './rich-text-block-renderer';
import { TestimonialsBlockEditor } from './testimonials-block-editor';
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
import { SocialShareBlockEditor } from './social-share-block-renderer';
import { RepeaterBlockEditor } from './repeater-block-editor';
import { SectionBlockEditor } from './section-block-editor';
import { ColumnsBlockEditor } from './columns-block-editor';
import { ColumnBlockEditor } from './column-block-editor';
import { CartBlockEditor } from './cart-block-editor';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { FaqBlockEditor } from './faq-block-editor';
import { ProductBlockEditor } from './product-block-editor';

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
        const props = {
            settings: selectedBlock.settings,
            onUpdate: (newSettings: any) => onUpdate(selectedBlock.id, newSettings),
        };
        
        const productProps = {
            ...props,
            availableProducts: availableProducts,
        };

        const productBlockTypes = ['productImage', 'productTitle', 'productPrice', 'productDescription', 'productAddToCart', 'productBreadcrumbs'];
        if (productBlockTypes.includes(selectedBlock.type)) {
            return <ProductBlockEditor {...props} blockType={selectedBlock.type} />;
        }

        switch (selectedBlock.type) {
            case 'hero': return <HeroBlockEditor {...props} />;
            case 'featuredProducts': return <FeaturedProductsBlockEditor {...productProps} />;
            case 'richText': return <RichTextBlockEditor {...props} />;
            case 'testimonials': return <TestimonialsBlockEditor {...props} />;
            case 'faq': return <FaqBlockEditor {...props} />;
            case 'customHtml': return <CustomHtmlBlockEditor {...props} />;
            case 'heading': return <HeadingBlockEditor {...props} />;
            case 'image': return <ImageBlockEditor {...props} />;
            case 'button': return <ButtonBlockEditor {...props} />;
            case 'video': return <VideoBlockEditor {...props} />;
            case 'icon': return <IconBlockEditor {...props} />;
            case 'spacer': return <SpacerBlockEditor {...props} />;
            case 'imageCarousel': return <ImageCarouselBlockEditor {...props} />;
            case 'tabs': return <TabsBlockEditor {...props} />;
            case 'accordion': return <AccordionBlockEditor {...props} />;
            case 'form': return <FormBlockEditor {...props} />;
            case 'map': return <MapBlockEditor {...props} />;
            case 'countdown': return <CountdownBlockEditor {...props} />;
            case 'socialShare': return <SocialShareBlockEditor {...props} />;
            case 'repeater': return <RepeaterBlockEditor {...props} />;
            case 'section': return <SectionBlockEditor {...props} />;
            case 'columns': return <ColumnsBlockEditor {...props} />;
            case 'column': return <ColumnBlockEditor {...props} />;
            case 'cart': return <CartBlockEditor {...props} />;
            default: return <p className="text-sm text-muted-foreground">Editor not available for this block type.</p>;
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
