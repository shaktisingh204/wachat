

'use client';

import React from 'react';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as LucideIcons from 'lucide-react';
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
import { Canvas } from './canvas';
import { HeadingBlock } from './heading-block-renderer';
import { RichTextBlockRenderer } from './rich-text-block-renderer';
import { ImageBlockRenderer } from './image-block-renderer';
import { VideoBlockRenderer } from './video-block-renderer';
import { ButtonBlockRenderer } from './button-block-renderer';


const CustomHtmlBlock = ({ settings }: { settings: any }) => (
    <div dangerouslySetInnerHTML={{ __html: settings.html || '' }} />
);

const IconBlock = ({ settings }: { settings: any }) => {
    // @ts-ignore
    const LucideIcon = LucideIcons[settings.icon] || LucideIcons.Star;

    const wrapperStyle: React.CSSProperties = {};
    if (settings.shape === 'circle' || settings.shape === 'square') {
        wrapperStyle.backgroundColor = settings.shapeColor || '#EEEEEE';
        wrapperStyle.display = 'inline-flex';
        wrapperStyle.alignItems = 'center';
        wrapperStyle.justifyContent = 'center';
        const padding = (settings.size || 48) / 4;
        wrapperStyle.padding = `${padding}px`;
        if (settings.shape === 'circle') {
            wrapperStyle.borderRadius = '50%';
        } else {
            wrapperStyle.borderRadius = '0.5rem';
        }
    }

    const iconStyle: React.CSSProperties = {
        width: `${settings.size || 48}px`,
        height: `${settings.size || 48}px`,
        color: settings.color || '#000000',
    };
    
    const animationClass = {
        rotate: 'group-hover:rotate-180',
        pulse: 'animate-pulse',
        bounce: 'animate-bounce',
    }[settings.animation || 'none'];
    
    const iconElement = (
         <div style={wrapperStyle} className="group">
            <LucideIcon style={iconStyle} className={cn('transition-transform duration-300', animationClass)} />
        </div>
    );

    if (settings.link) {
        return (
            <a href={settings.link} target="_blank" rel="noopener noreferrer" className="inline-block">
                {iconElement}
            </a>
        );
    }
    
    return iconElement;
};

const SpacerBlock = ({ settings }: { settings: any }) => {
    const type = settings.type || 'spacer';
    
    const responsiveClasses = cn({
        'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const animationClass = {
        fadeIn: 'animate-in fade-in duration-500',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
    }[settings.animation || 'none'];

    const baseStyle: React.CSSProperties = {
        marginTop: settings.margin?.top ? `${settings.margin.top}px` : undefined,
        marginRight: settings.margin?.right ? `${settings.margin.right}px` : undefined,
        marginBottom: settings.margin?.bottom ? `${settings.margin.bottom}px` : undefined,
        marginLeft: settings.margin?.left ? `${settings.margin.left}px` : undefined,
        paddingTop: settings.padding?.top ? `${settings.padding.top}px` : undefined,
        paddingRight: settings.padding?.right ? `${settings.padding.right}px` : undefined,
        paddingBottom: settings.padding?.bottom ? `${settings.padding.bottom}px` : undefined,
        paddingLeft: settings.padding?.left ? `${settings.padding.left}px` : undefined,
        zIndex: settings.zIndex || undefined,
    };
    
    const customAttributes = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    const customStyleTag = settings.customCss ? (
        <style>{`#${settings.cssId || ''} { ${settings.customCss} }`}</style>
    ) : null;

    if (type === 'divider') {
        const dividerStyle: React.CSSProperties = {
            ...baseStyle,
            width: settings.width || '100%',
            borderTopStyle: settings.style || 'solid',
            borderTopWidth: `${settings.thickness || 1}px`,
            borderColor: settings.color || 'hsl(var(--border))',
        };
        
        const alignmentClass = {
            left: 'mr-auto',
            center: 'mx-auto',
            right: 'ml-auto',
        }[settings.alignment || 'center'];

        return (
            <>
                {customStyleTag}
                <hr 
                    id={settings.cssId} 
                    style={dividerStyle} 
                    className={cn(alignmentClass, responsiveClasses, animationClass, settings.cssClasses)} 
                    {...customAttributes} 
                />
            </>
        );
    }

    // Spacer
    const spacerStyle: React.CSSProperties = {
        ...baseStyle,
        height: `${settings.height || 24}px`,
    };

    return (
        <>
            {customStyleTag}
            <div 
                id={settings.cssId} 
                style={spacerStyle} 
                className={cn(responsiveClasses, animationClass, settings.cssClasses)} 
                {...customAttributes}
            ></div>
        </>
    );
};

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
        case 'icon': return <IconBlock settings={safeSettings} />;
        case 'spacer': return <SpacerBlock settings={safeSettings} />;
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
