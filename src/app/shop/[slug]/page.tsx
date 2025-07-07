

import { notFound } from 'next/navigation';
import { getEcommShopBySlug, getEcommProducts } from '@/app/actions/custom-ecommerce.actions';
import type { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { ImageCarouselRenderer } from '@/components/wabasimplify/website-builder/image-carousel-renderer';
import { TabsBlockRenderer } from '@/components/wabasimplify/website-builder/tabs-block-renderer';
import { AccordionBlockRenderer } from '@/components/wabasimplify/website-builder/accordion-block-renderer';
import { FormBlockRenderer } from '@/components/wabasimplify/website-builder/form-block-renderer';
import { MapBlockRenderer } from '@/components/wabasimplify/website-builder/map-block-renderer';


const HeroBlock = ({ settings }: { settings: any }) => (
    <div className="relative w-full h-80 md:h-96 text-white rounded-lg overflow-hidden flex items-center justify-center text-center p-4" style={{ backgroundColor: settings.backgroundColor || '#111827' }}>
        {settings.backgroundImageUrl && <Image src={settings.backgroundImageUrl} alt={settings.title || 'Banner'} layout="fill" objectFit="cover" className="opacity-30" data-ai-hint="store banner"/>}
        <div className="relative z-10 space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#FFFFFF'}}>{settings.title || 'Welcome to Our Shop'}</h1>
            <p className="text-lg md:text-xl text-white/80" style={{fontFamily: settings.fontFamily}}>{settings.subtitle || 'Discover our amazing products'}</p>
            {settings.buttonText && <Button size="lg" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>{settings.buttonText}</Button>}
        </div>
    </div>
);

const FeaturedProductsBlock = ({ settings, products }: { settings: any, products: WithId<EcommProduct>[] }) => {
    const productIds = settings.productIds || [];
    const featuredProducts = products.filter(p => productIds.includes(p._id.toString()));
    const gridCols = settings.columns === '4' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    return (
        <div className="w-full">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold">{settings.title || 'Featured Products'}</h2>
                <p className="text-muted-foreground">{settings.subtitle}</p>
            </div>
             <div className={cn("grid gap-6", gridCols)}>
                {featuredProducts.map(product => (
                    <Card key={product._id.toString()}>
                        <CardHeader className="p-0">
                            <div className="relative aspect-square">
                                <Image src={product.imageUrl || 'https://placehold.co/400x400.png'} alt={product.name} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="product image"/>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

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

const TestimonialsBlock = ({ settings }: { settings: any }) => (
    <div className="w-full">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'What Our Customers Say'}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.testimonials || []).map((item: any) => (
                <Card key={item.id}>
                    <CardContent className="p-6">
                        <p className="italic">"{item.quote}"</p>
                    </CardContent>
                    <CardFooter>
                        <p className="font-semibold">{item.author}</p>
                        <p className="text-sm text-muted-foreground ml-2">- {item.title}</p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    </div>
);

const FaqBlock = ({ settings }: { settings: any }) => (
     <div className="w-full max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'Frequently Asked Questions'}</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
            {(settings.faqItems || []).map((item: any, index: number) => (
                <AccordionItem value={`item-${item.id || index}`} key={item.id || index}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    </div>
);

const CustomHtmlBlock = ({ settings }: { settings: any }) => (
    <div dangerouslySetInnerHTML={{ __html: settings.html || '' }} />
);

const HeadingBlock = ({ settings }: { settings: any }) => {
    const Tag = settings.htmlTag || 'h2';
    const style: React.CSSProperties = {
        fontFamily: settings.fontFamily || 'inherit',
        fontSize: settings.fontSize ? `${settings.fontSize}px` : undefined,
        fontWeight: settings.fontWeight || 'normal',
        fontStyle: settings.fontStyle || 'normal',
        color: settings.color || 'inherit',
        textAlign: settings.textAlign || 'left',
        textShadow: settings.textShadow ? `${settings.textShadow.x || 0}px ${settings.textShadow.y || 0}px ${settings.textShadow.blur || 0}px ${settings.textShadow.color || 'transparent'}` : 'none',
        margin: settings.margin ? `${settings.margin.top || 0}px ${settings.margin.right || 0}px ${settings.margin.bottom || 0}px ${settings.margin.left || 0}px` : undefined,
        padding: settings.padding ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px` : undefined,
    };

    const animationClass = {
        fade: 'animate-fade-in',
        slide: 'animate-slide-in-up',
        zoom: 'animate-in zoom-in-50',
        bounce: 'animate-bounce',
    }[settings.animation || 'none'];

    return React.createElement(Tag, {
        style,
        className: cn(animationClass)
    }, settings.text || 'Heading Text');
};

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

    return (
         <Button asChild style={buttonStyle} className={cn(shapeClasses, hoverClasses, "transition-transform duration-300")}>
            <Link href={settings.link || '#'}>
                {Icon && settings.iconPosition === 'left' && <Icon className="mr-2 h-4 w-4" />}
                {settings.text || 'Button'}
                {Icon && settings.iconPosition === 'right' && <Icon className="ml-2 h-4 w-4" />}
            </Link>
        </Button>
    )
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
    const marginTop = settings.margin?.top || '16';
    const marginBottom = settings.margin?.bottom || '16';

    const style: React.CSSProperties = {
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`,
    };

    if (type === 'divider') {
        const dividerStyle: React.CSSProperties = {
            ...style,
            width: settings.width || '100%',
            borderTopStyle: settings.style || 'solid',
            borderTopWidth: `${settings.thickness || 1}px`,
            borderColor: settings.color || 'hsl(var(--border))',
            marginRight: 'auto',
            marginLeft: 'auto',
        };
         if (settings.alignment === 'left') {
            dividerStyle.marginRight = 'auto';
            dividerStyle.marginLeft = '0';
        } else if (settings.alignment === 'right') {
            dividerStyle.marginLeft = 'auto';
            dividerStyle.marginRight = '0';
        }
        return <hr style={dividerStyle} />;
    }

    // Spacer
    const spacerStyle: React.CSSProperties = {
        ...style,
        height: `${settings.height || 24}px`,
    };

    return <div style={spacerStyle}></div>;
};


export default async function ShopPage({ params }: { params: { slug: string } }) {
    if (!params.slug) {
        notFound();
    }

    const shop = await getEcommShopBySlug(params.slug);

    if (!shop) {
        notFound();
    }
    
    const products = await getEcommProducts(shop._id.toString());
    const homepageLayout = shop.homepageLayout || [];

    const BlockRenderer = ({ block }: { block: WebsiteBlock }) => {
        switch (block.type) {
            case 'hero':
                return <HeroBlock settings={block.settings} />;
            case 'featuredProducts':
                return <FeaturedProductsBlock settings={block.settings} products={products} />;
            case 'richText':
                return <RichTextBlock settings={block.settings} />;
            case 'testimonials':
                return <TestimonialsBlock settings={block.settings} />;
            case 'faq':
                return <FaqBlock settings={block.settings} />;
            case 'customHtml':
                return <CustomHtmlBlock settings={block.settings} />;
            case 'heading':
                return <HeadingBlock settings={block.settings} />;
            case 'image':
                return <ImageBlock settings={block.settings} />;
            case 'button':
                return <ButtonBlock settings={block.settings} />;
            case 'video':
                return <VideoBlock settings={block.settings} />;
            case 'icon':
                return <IconBlock settings={block.settings} />;
            case 'spacer':
                return <SpacerBlock settings={block.settings} />;
            case 'imageCarousel':
                return <ImageCarouselRenderer settings={block.settings} />;
            case 'tabs':
                return <TabsBlockRenderer settings={block.settings} />;
            case 'accordion':
                return <AccordionBlockRenderer settings={block.settings} />;
            case 'form':
                return <FormBlockRenderer settings={block.settings} />;
            case 'map':
                return <MapBlockRenderer settings={block.settings} />;
            default:
                return <div className="text-center text-muted-foreground">Unsupported block type: {block.type}</div>;
        }
    };
    
    const heroBlock = homepageLayout.find(b => b.type === 'hero');
    const globalFontFamily = heroBlock?.settings?.fontFamily || 'Inter, sans-serif';

    return (
        <div style={{ fontFamily: globalFontFamily }}>
            <main className="flex flex-col items-center space-y-12 md:space-y-16 p-4 md:p-8">
                {homepageLayout.length > 0 ? (
                    homepageLayout.map(block => <BlockRenderer key={block.id} block={block} />)
                ) : (
                    <div className="text-center py-24">
                        <h1 className="text-4xl font-bold">{shop.name}</h1>
                        <p className="text-lg text-muted-foreground mt-4">This shop is under construction. Come back soon!</p>
                    </div>
                )}
            </main>
        </div>
    );
}
