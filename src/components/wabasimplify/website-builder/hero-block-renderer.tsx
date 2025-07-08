
'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import useEmblaCarousel, { EmblaOptionsType } from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ShapeDivider } from './shape-divider';

const BackgroundSlideshow = ({ images }: { images: {src: string}[] }) => {
    const options: EmblaOptionsType = { loop: true, align: 'start' };
    const plugins = [Autoplay({ delay: 5000, stopOnInteraction: false })];
    const [emblaRef] = useEmblaCarousel(options, plugins);

    return (
         <div className="embla absolute inset-0 overflow-hidden" ref={emblaRef}>
            <div className="embla__container h-full">
                {images.map((image, index) => (
                    <div className="embla__slide relative h-full" key={index}>
                        <Image src={image.src} alt={`Slideshow image ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint="hero background" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function HeroBlock({ settings }: { settings: any }) {
    const safeSettings = settings || {};
    const { 
        layout = 'center', title = 'Hero Title', subtitle = 'Hero subtitle text goes here.', buttonText, buttonLink,
        backgroundImageUrl, backgroundColor, textColor, buttonColor, buttonTextColor, height = '600px', verticalAlign = 'center',
        textAlign = 'center', overlayColor, overlayOpacity, animation, borderRadius, boxShadow, zIndex,
        padding, margin, cssId, cssClasses,
        backgroundType, backgroundVideoUrl, slideshowImages, topShape, topShapeColor, topShapeHeight, bottomShape, bottomShapeColor, bottomShapeHeight, sticky, responsiveVisibility
    } = safeSettings;
    
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true) }, []);

    const alignmentClasses = { 'flex-start': 'items-start', 'center': 'items-center', 'flex-end': 'items-end' }[verticalAlign] || 'items-center';
    const textAlignClasses = { 'left': 'text-left', 'center': 'text-center', 'right': 'text-right' }[textAlign] || 'text-center';
    const animationClasses = { 'fade': 'animate-fade-in', 'slide-up': 'animate-fade-in-up', 'zoom': 'animate-in zoom-in-50' }[animation || 'none'];
    
    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': responsiveVisibility?.tablet === false,
        'max-sm:hidden': responsiveVisibility?.mobile === false
    });

    const shadowClasses = { 'none': 'shadow-none', 'sm': 'shadow-sm', 'md': 'shadow-md', 'lg': 'shadow-lg' }[boxShadow || 'none'];

    const sectionStyle: React.CSSProperties = {
        backgroundColor: backgroundType === 'classic' ? backgroundColor : undefined,
        height,
        borderRadius: borderRadius ? `${borderRadius}px` : undefined,
        zIndex: zIndex || undefined,
        paddingTop: padding?.top ? `${padding.top}px` : undefined,
        paddingRight: padding?.right ? `${padding.right}px` : undefined,
        paddingBottom: padding?.bottom ? `${padding.bottom}px` : undefined,
        paddingLeft: padding?.left ? `${padding.left}px` : undefined,
        marginTop: margin?.top ? `${margin.top}px` : undefined,
        marginBottom: margin?.bottom ? `${margin.bottom}px` : undefined,
        position: sticky === 'top' ? 'sticky' : 'relative',
        top: sticky === 'top' ? 0 : undefined,
    };
    
    const content = (
        <div className={cn("relative z-10 space-y-4 max-w-7xl mx-auto px-4 w-full", animationClasses, textAlignClasses)}>
            <div className="max-w-2xl mx-auto space-y-4">
                <h1 className="text-4xl md:text-6xl font-extrabold" style={{ color: textColor }}>{title}</h1>
                <p className="text-lg md:text-xl" style={{ color: textColor }}>{subtitle}</p>
                {buttonText && (
                    <Button asChild size="lg" className="mt-6" style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
                        <Link href={buttonLink || '#'}>{buttonText}</Link>
                    </Button>
                )}
            </div>
        </div>
    );
    
    if (layout === 'offset-box') {
        const offsetBoxStyles: React.CSSProperties = { ...sectionStyle, backgroundColor: backgroundColor || '#F3F4F6' };
        return (
            <div className={cn("relative w-full flex", responsiveClasses)} style={offsetBoxStyles}>
                {backgroundImageUrl && <Image src={backgroundImageUrl} alt={title || 'Banner'} layout="fill" objectFit="cover" className="opacity-90" data-ai-hint="hero banner" />}
                <div className="relative z-10 h-full flex items-center max-w-7xl mx-auto px-4 w-full">
                    <div className={cn("max-w-md bg-background/80 backdrop-blur-sm p-8 rounded-lg", animationClasses)}>
                        <h1 className="text-4xl md:text-5xl font-extrabold" style={{color: textColor || '#11182c'}}>{title}</h1>
                        <p className="mt-4 text-lg md:text-xl" style={{color: textColor || '#11182c'}}>{subtitle}</p>
                        {buttonText && <Button asChild size="lg" className="mt-6" style={{backgroundColor: buttonColor, color: buttonTextColor}}><Link href={buttonLink || '#'}>{buttonText}</Link></Button>}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div id={cssId} className={cn("relative w-full flex flex-col justify-center overflow-hidden", alignmentClasses, shadowClasses, responsiveClasses, cssClasses)} style={sectionStyle}>
            {topShape && topShape !== 'none' && isClient && <ShapeDivider type={topShape} color={topShapeColor} height={topShapeHeight} position="top" />}
            
            {/* Background Layers */}
            {backgroundType === 'classic' && backgroundImageUrl && <Image src={backgroundImageUrl} alt={title} layout="fill" objectFit="cover" data-ai-hint="hero banner" />}
            {backgroundType === 'video' && backgroundVideoUrl && <video src={backgroundVideoUrl} autoPlay loop muted playsInline className="absolute w-full h-full object-cover top-0 left-0" />}
            {backgroundType === 'slideshow' && isClient && Array.isArray(slideshowImages) && slideshowImages.length > 0 && <BackgroundSlideshow images={slideshowImages} />}
            
            {overlayColor && <div className="absolute inset-0" style={{ backgroundColor: overlayColor, opacity: overlayOpacity || 0.3 }} />}
            
            {content}

            {bottomShape && bottomShape !== 'none' && isClient && <ShapeDivider type={bottomShape} color={bottomShapeColor} height={bottomShapeHeight} position="bottom" />}
        </div>
    );
};
