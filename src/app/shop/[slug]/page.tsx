
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
}


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
