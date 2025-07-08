
'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function HeroBlock({ settings }: { settings: any }) {
    const safeSettings = settings || {};
    const { 
        layout = 'center',
        title = 'Hero Title',
        subtitle = 'Hero subtitle text goes here.',
        buttonText,
        buttonLink,
        backgroundImageUrl,
        backgroundColor,
        textColor,
        buttonColor,
        buttonTextColor,
        height = '600px',
        verticalAlign = 'center',
        textAlign = 'center',
        overlayColor,
        overlayOpacity,
        animation
    } = safeSettings;
    
    const alignmentClasses = {
        'flex-start': 'items-start',
        'center': 'items-center',
        'flex-end': 'items-end'
    }[verticalAlign] || 'items-center';

    const textAlignClasses = {
        'left': 'text-left',
        'center': 'text-center',
        'right': 'text-right'
    }[textAlign] || 'text-center';

    const animationClasses = {
        'fade': 'animate-fade-in',
        'slide-up': 'animate-fade-in-up'
    }[animation || 'fade'];
    
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
        return (
            <div className="relative w-full flex" style={{ backgroundColor: backgroundColor || '#F3F4F6', height }}>
                {backgroundImageUrl && <Image src={backgroundImageUrl} alt={title || 'Banner'} layout="fill" objectFit="cover" className="opacity-90" data-ai-hint="fashion model"/>}
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
        <div className={cn("relative w-full flex flex-col justify-center", alignmentClasses)} style={{ backgroundColor, height }}>
            {backgroundImageUrl && <Image src={backgroundImageUrl} alt={title} layout="fill" objectFit="cover" />}
            {overlayColor && (
                <div 
                    className="absolute inset-0"
                    style={{ backgroundColor: overlayColor, opacity: overlayOpacity || 0.3 }}
                />
            )}
            {content}
        </div>
    );
};
