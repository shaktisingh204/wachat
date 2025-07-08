
'use client';

import React from 'react';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { ImageCarouselRenderer } from '@/components/wabasimplify/website-builder/image-carousel-renderer';
import { TabsBlockRenderer } from '@/components/wabasimplify/website-builder/tabs-block-renderer';
import { AccordionBlockRenderer } from '@/components/wabasimplify/website-builder/accordion-block-renderer';
import { FormBlockRenderer } from '@/components/wabasimplify/website-builder/form-block-renderer';
import { MapBlockRenderer } from '@/components/wabasimplify/website-builder/map-block-renderer';
import { CountdownBlockRenderer } from '@/components/wabasimplify/website-builder/countdown-block-renderer';
import { SocialShareBlockRenderer } from '@/components/wabasimplify/website-builder/social-share-block-renderer';
import { RepeaterBlockRenderer } from '@/components/wabasimplify/website-builder/repeater-block-renderer';
import { SectionBlockRenderer } from './section-block-renderer';
import { ColumnsBlockRenderer } from './columns-block-renderer';
import { HeroBlock } from './hero-block-renderer';
import { FaqBlockRenderer } from './faq-block-renderer';
import { TestimonialsBlockRenderer } from './testimonials-block-renderer';
import { FeaturedProductsBlockRenderer } from './featured-products-block-renderer';
import { HeadingBlock } from './heading-block-renderer';
import { RichTextBlockRenderer } from './rich-text-block-renderer';
import { ImageBlockRenderer } from './image-block-renderer';
import { VideoBlockRenderer } from './video-block-renderer';
import { ButtonBlockRenderer } from './button-block-renderer';
import { SpacerBlockRenderer } from './spacer-block-renderer';
import { IconBlockRenderer } from './icon-block-renderer';


const CustomHtmlBlock = ({ settings }: { settings: any }) => (
    <div dangerouslySetInnerHTML={{ __html: settings.html || '' }} />
);

interface BlockRendererProps {
  block: WebsiteBlock;
  products: WithId<EcommProduct>[];
  shopSlug: string;
  selectedBlockId?: string | null;
  onBlockClick?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
  isEditable?: boolean;
}

export const BlockRenderer: React.FC<BlockRendererProps> = (props) => {
    const { block, products, shopSlug, isEditable } = props;
    const safeSettings = block.settings || {};

    switch (block.type) {
        case 'hero': return <HeroBlock settings={safeSettings} />;
        case 'featuredProducts': return <FeaturedProductsBlockRenderer settings={safeSettings} products={products} shopSlug={shopSlug}/>;
        case 'richText': return <RichTextBlockRenderer settings={safeSettings} />;
        case 'testimonials': return <TestimonialsBlockRenderer settings={safeSettings} />;
        case 'faq': return <FaqBlockRenderer settings={safeSettings} />;
        case 'customHtml': return <CustomHtmlBlock settings={safeSettings} />;
        case 'heading': return <HeadingBlock settings={safeSettings} />;
        case 'image': return <ImageBlockRenderer settings={safeSettings} />;
        case 'button': return <ButtonBlockRenderer settings={safeSettings} />;
        case 'video': return <VideoBlockRenderer settings={safeSettings} />;
        case 'icon': return <IconBlockRenderer settings={safeSettings} />;
        case 'spacer': return <SpacerBlockRenderer settings={safeSettings} />;
        case 'imageCarousel': return <ImageCarouselRenderer settings={safeSettings} />;
        case 'tabs': return <TabsBlockRenderer settings={safeSettings} />;
        case 'accordion': return <AccordionBlockRenderer settings={safeSettings} />;
        case 'form': return <FormBlockRenderer settings={safeSettings} />;
        case 'map': return <MapBlockRenderer settings={safeSettings} />;
        case 'countdown': return <CountdownBlockRenderer settings={safeSettings} />;
        case 'socialShare': return <SocialShareBlockRenderer settings={safeSettings} />;
        case 'repeater': return <RepeaterBlockRenderer settings={safeSettings} />;
        case 'section': return <SectionBlockRenderer {...props} children={block.children || []} isEditable={isEditable} />;
        case 'columns': return <ColumnsBlockRenderer {...props} children={block.children || []} isEditable={isEditable} />;
        default: return <div className="text-center text-muted-foreground">Unsupported block type: {block.type}</div>;
    }
};
