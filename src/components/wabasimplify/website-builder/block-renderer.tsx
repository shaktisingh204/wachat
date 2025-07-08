
'use client';

import React from 'react';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
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


const RichTextBlock = ({ settings }: { settings: any }) => {
    const style: React.CSSProperties = {
        fontFamily: settings.fontFamily || 'inherit',
        fontSize: settings.fontSize ? `${settings.fontSize}px` : undefined,
        lineHeight: settings.lineHeight || 'inherit',
        color: settings.color || 'inherit',
        textAlign: settings.textAlign || 'left',
        padding: settings.padding ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px` : undefined,
    };

    const animationClass = {
        fade: 'animate-fade-in',
        slide: 'animate-slide-in-up',
        zoom: 'animate-in zoom-in-50',
    }[settings.animation || 'none'];

    return <div style={style} className={cn("prose dark:prose-invert max-w-none", animationClass)} dangerouslySetInnerHTML={{ __html: settings.htmlContent || '' }} />;
};

const CustomHtmlBlock = ({ settings }: { settings: any }) => (
    <div dangerouslySetInnerHTML={{ __html: settings.html || '' }} />
);

const ImageBlock = ({ settings }: { settings: any }) => {
    const sizeClasses = {
        small: 'w-1/3',
        medium: 'w-1/2',
        large: 'w-3/4',
        full: 'w-full',
    }[settings.size || 'medium'];

    const alignClasses = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end',
    }[settings.align || 'center'];

    const shapeClasses = {
        square: 'rounded-none',
        rounded: 'rounded-lg',
        circle: 'rounded-full aspect-square object-cover',
    }[settings.shape || 'rounded'];

    const shadowClasses = {
        none: 'shadow-none',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
    }[settings.shadow || 'none'];

    const hoverClasses = {
        none: '',
        zoom: 'group-hover:scale-105',
        grayscale: 'group-hover:grayscale',
    }[settings.hoverEffect || 'none'];

    const borderStyle = settings.border?.enabled ? {
        borderWidth: `${settings.border.width || 1}px`,
        borderColor: settings.border.color || '#000000',
        borderStyle: 'solid',
    } : {};
    
    const imageElement = (
        <Image
            src={settings.src || 'https://placehold.co/600x400.png'}
            alt={settings.alt || 'Shop image'}
            width={800}
            height={600}
            className={cn('transition-transform duration-300', shapeClasses, hoverClasses)}
            style={borderStyle}
            data-ai-hint="shop image"
        />
    );

    return (
        <figure className={cn('flex', alignClasses)}>
            <div className={cn('group space-y-2', sizeClasses, shadowClasses, shapeClasses !== 'rounded-full' ? '' : 'overflow-hidden')}>
                {settings.link ? (
                    <a href={settings.link} target="_blank" rel="noopener noreferrer">
                        {imageElement}
                    </a>
                ) : (
                    imageElement
                )}
                {settings.caption && <figcaption className="text-sm text-center text-muted-foreground">{settings.caption}</figcaption>}
            </div>
        </figure>
    );
};

const ButtonBlock = ({ settings }: { settings: any }) => {
    // @ts-ignore
    const Icon = LucideIcons[settings.icon] || null;

    const buttonStyle: React.CSSProperties = {
        fontFamily: settings.fontFamily || 'inherit',
        fontSize: settings.fontSize ? `${settings.fontSize}px` : undefined,
        fontWeight: settings.fontWeight || 'normal',
        fontStyle: settings.fontStyle || 'normal',
        backgroundColor: settings.backgroundColor || undefined,
        color: settings.textColor || undefined,
        paddingTop: settings.padding?.y ? `${settings.padding.y}px` : undefined,
        paddingBottom: settings.padding?.y ? `${settings.padding.y}px` : undefined,
        paddingLeft: settings.padding?.x ? `${settings.padding.x}px` : undefined,
        paddingRight: settings.padding?.x ? `${settings.padding.x}px` : undefined,
        borderWidth: settings.border?.width ? `${settings.border.width}px` : undefined,
        borderColor: settings.border?.color || undefined,
        borderStyle: 'solid',
    };

    const shapeClasses = {
        square: 'rounded-none',
        rounded: 'rounded-md',
        pill: 'rounded-full',
    }[settings.shape || 'rounded'];

    const hoverClasses = {
        scale: 'hover:scale-105',
        colorSwap: `hover:bg-[${settings.hoverBackgroundColor}] hover:text-[${settings.hoverTextColor}]`,
    }[settings.hoverEffect || 'scale'];

    return React.createElement(Button, {
        asChild: !!settings.link,
        style: buttonStyle,
        className: cn(shapeClasses, hoverClasses, "transition-transform duration-300")
    }, settings.link ? (
        <a href={settings.link}>
            {Icon && settings.iconPosition === 'left' && React.createElement(Icon, { className: "mr-2 h-4 w-4" })}
            {settings.text || 'Button'}
            {Icon && settings.iconPosition === 'right' && React.createElement(Icon, { className: "ml-2 h-4 w-4" })}
        </a>
    ) : (
        <>
            {Icon && settings.iconPosition === 'left' && React.createElement(Icon, { className: "mr-2 h-4 w-4" })}
            {settings.text || 'Button'}
            {Icon && settings.iconPosition === 'right' && React.createElement(Icon, { className: "ml-2 h-4 w-4" })}
        </>
    ));
};

const VideoBlock = ({ settings }: { settings: any }) => {
    const { sourceUrl, autoPlay, controls, muted, aspectRatio, coverImageUrl, playIconColor, playIconSize } = settings;

    const getEmbedUrl = () => {
        if (!sourceUrl) return null;
        try {
            const url = new URL(sourceUrl);
            if (url.hostname.includes('youtube.com')) {
                const videoId = url.searchParams.get('v');
                return `https://www.youtube.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}&controls=${controls ? 1 : 0}&mute=${muted ? 1 : 0}`;
            }
            if (url.hostname.includes('vimeo.com')) {
                const videoId = url.pathname.split('/').pop();
                return `https://player.vimeo.com/video/${videoId}?autoplay=${autoPlay ? 1 : 0}&controls=${controls ? 1 : 0}&muted=${muted ? 1 : 0}`;
            }
        } catch (e) { /* Invalid URL, fallback to direct player */ }
        return sourceUrl; // Assume direct MP4 link
    };

    const embedUrl = getEmbedUrl();
    const isEmbed = embedUrl && (embedUrl.includes('youtube') || embedUrl.includes('vimeo'));

    const aspectClass = {
        '16:9': 'aspect-video',
        '4:3': 'aspect-[4/3]',
        '1:1': 'aspect-square',
    }[aspectRatio || '16:9'];

    return (
        <div className={cn('relative w-full rounded-lg overflow-hidden', aspectClass)} style={{
            boxShadow: settings.shadow ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none',
            border: settings.border ? `${settings.border.width || 1}px solid ${settings.border.color || '#000'}` : 'none',
            borderRadius: `${settings.border?.radius || 8}px`
        }}>
            {isEmbed ? (
                <iframe
                    src={embedUrl!}
                    title="Embedded Video"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                ></iframe>
            ) : (
                <video
                    src={sourceUrl}
                    controls={controls}
                    autoPlay={autoPlay}
                    muted={muted}
                    poster={coverImageUrl}
                    className="w-full h-full object-cover"
                >
                    Your browser does not support the video tag.
                </video>
            )}
        </div>
    );
};

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
        'max-md:hidden lg:hidden': settings.responsiveVisibility?.tablet === false,
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
        case 'richText': return <RichTextBlock settings={safeSettings} />;
        case 'testimonials': return <TestimonialsBlockRenderer settings={safeSettings} />;
        case 'faq': return <FaqBlockRenderer settings={safeSettings} />;
        case 'customHtml': return <CustomHtmlBlock settings={safeSettings} />;
        case 'heading': return <HeadingBlock settings={safeSettings} />;
        case 'image': return <ImageBlock settings={safeSettings} />;
        case 'button': return <ButtonBlock settings={safeSettings} />;
        case 'video': return <VideoBlock settings={safeSettings} />;
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
