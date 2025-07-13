

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
import { CartBlockRenderer } from './cart-block-renderer';
import { ProductImageRenderer, ProductTitleRenderer, ProductPriceRenderer, ProductDescriptionRenderer, ProductAddToCartRenderer, ProductBreadcrumbsRenderer } from './product-block-renderers';


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
  contextData?: any;
}

const CrmAutomationBlockRenderer = () => <div className="hidden"></div>;

export const BlockRenderer: React.FC<BlockRendererProps> = (props) => {
    const { block, products, shopSlug, isEditable, contextData } = props;
    const safeSettings = block.settings || {};

    const productContext = contextData?.product || null;
    
    const rendererProps = {
      settings: safeSettings,
      contextData: contextData,
    };

    switch (block.type) {
        case 'hero': return <HeroBlock {...rendererProps} />;
        case 'featuredProducts': return <FeaturedProductsBlockRenderer settings={safeSettings} products={products} shopSlug={shopSlug}/>;
        case 'richText': return <RichTextBlockRenderer {...rendererProps} />;
        case 'testimonials': return <TestimonialsBlockRenderer {...rendererProps} />;
        case 'faq': return <FaqBlockRenderer {...rendererProps} />;
        case 'customHtml': return <CustomHtmlBlock {...rendererProps} />;
        case 'heading': return <HeadingBlock {...rendererProps} />;
        case 'image': return <ImageBlockRenderer {...rendererProps} />;
        case 'button': return <ButtonBlockRenderer {...rendererProps} />;
        case 'video': return <VideoBlockRenderer {...rendererProps} />;
        case 'icon': return <IconBlockRenderer {...rendererProps} />;
        case 'spacer': return <SpacerBlockRenderer {...rendererProps} />;
        case 'imageCarousel': return <ImageCarouselRenderer {...rendererProps} />;
        case 'tabs': return <TabsBlockRenderer {...rendererProps} />;
        case 'accordion': return <AccordionBlockRenderer {...rendererProps} />;
        case 'form': return <FormBlockRenderer {...rendererProps} />;
        case 'map': return <MapBlockRenderer {...rendererProps} />;
        case 'countdown': return <CountdownBlockRenderer {...rendererProps} />;
        case 'socialShare': return <SocialShareBlockRenderer {...rendererProps} />;
        case 'repeater': return <RepeaterBlockRenderer {...rendererProps} />;
        case 'cart': return <CartBlockRenderer {...rendererProps} />;
        case 'crmAutomation': return <CrmAutomationBlockRenderer />;
        case 'productImage': return <ProductImageRenderer product={productContext} settings={safeSettings} />;
        case 'productTitle': return <ProductTitleRenderer product={productContext} settings={safeSettings} />;
        case 'productPrice': return <ProductPriceRenderer product={productContext} settings={safeSettings} />;
        case 'productDescription': return <ProductDescriptionRenderer product={productContext} settings={safeSettings} />;
        case 'productAddToCart': return <ProductAddToCartRenderer product={productContext} settings={safeSettings} />;
        case 'productBreadcrumbs': return <ProductBreadcrumbsRenderer product={productContext} settings={safeSettings} />;
        case 'section': return <SectionBlockRenderer {...props} children={block.children || []} />;
        case 'columns': return <ColumnsBlockRenderer {...props} children={block.children || []} />;
        default: return <div className="text-center text-muted-foreground">Unsupported block type: {block.type}</div>;
    }
};
