
'use client';

import React from 'react';
import useEmblaCarousel, { type EmblaOptionsType } from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Image from 'next/image';
import Link from 'next/link';
import { DotButton, useDotButton } from './embla-carousel-dot-button';
import { PrevButton, NextButton, usePrevNextButtons } from './embla-carousel-arrow-buttons';
import { cn } from '@/lib/utils';

type CarouselImage = {
  id: string;
  src: string;
  link?: string;
  caption?: string;
};

interface ImageCarouselRendererProps {
  settings: {
    images?: CarouselImage[];
    slidesToShow?: number;
    slidesToScroll?: number;
    autoplay?: boolean;
    autoplayDelay?: number;
    loop?: boolean;
    pauseOnHover?: boolean;
    navigation?: 'none' | 'arrows' | 'dots' | 'arrows_dots';
    imageStretch?: boolean;
    
    // Style
    spacing?: number;
    borderRadius?: number;
    border?: { type?: string; width?: number; color?: string };
    boxShadow?: 'none' | 'sm' | 'md' | 'lg';
    hoverAnimation?: 'none' | 'zoom' | 'grow' | 'shrink';
    arrowPosition?: 'inside' | 'outside';
    arrowSize?: number;
    arrowColor?: string;
    arrowBgColor?: string;
    dotSize?: number;
    dotSpacing?: number;
    dotColor?: string;
    activeDotColor?: string;
    
    // Advanced
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    animation?: 'none' | 'fadeIn' | 'fadeInUp';
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

export const ImageCarouselRenderer: React.FC<ImageCarouselRendererProps> = ({ settings }) => {
    const { 
        images = [],
        slidesToShow = 1,
        slidesToScroll = 1,
        autoplay = false,
        autoplayDelay = 3000,
        loop = false,
        pauseOnHover = false,
        navigation = 'arrows_dots',
        spacing = 16,
        arrowPosition = 'inside',
    } = settings;

    const options: EmblaOptionsType = { 
        loop, 
        align: 'start', 
        slidesToScroll,
        slidesToShow
    };
    
    const plugins = autoplay ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: !pauseOnHover, stopOnMouseEnter: pauseOnHover })] : [];
    
    const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);
    
    const { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(emblaApi);
    const { prevBtnDisabled, nextBtnDisabled, onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi);

    if (images.length === 0) {
        return <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">Image Carousel: No images added.</div>;
    }
    
    const hoverClass = {
        none: '',
        zoom: 'group-hover:scale-105',
        grow: 'group-hover:scale-110',
        shrink: 'group-hover:scale-95',
    }[settings.hoverAnimation || 'none'];
    
    const shadowClass = {
        none: 'shadow-none',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
    }[settings.boxShadow || 'none'];

    const animationClass = {
        fadeIn: 'animate-in fade-in duration-500',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
    }[settings.animation || 'none'];
    
    const responsiveClasses = cn({
        'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
        'max-md:hidden lg:hidden': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const customAttributes = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});
    
    const uniqueId = React.useId().replace(/:/g, "");

    const dynamicStyles = `
        .embla__slide--${uniqueId} {
            flex: 0 0 ${100 / slidesToShow}%;
            min-width: 0;
            padding-left: ${spacing / 2}px;
            padding-right: ${spacing / 2}px;
        }
        .embla__button--${uniqueId} {
            width: ${settings.arrowSize || 40}px;
            height: ${settings.arrowSize || 40}px;
            background-color: ${settings.arrowBgColor || 'rgba(0,0,0,0.5)'};
        }
        .embla__button__svg--${uniqueId} {
            width: 50%;
            height: 50%;
            color: ${settings.arrowColor || '#ffffff'};
        }
        .embla__dot--${uniqueId} {
            width: ${settings.dotSize || 12}px;
            height: ${settings.dotSize || 12}px;
            margin: 0 ${settings.dotSpacing / 2 || 4}px;
            background-color: ${settings.dotColor || 'hsla(0, 0%, 100%, 0.3)'};
        }
        .embla__dot--${uniqueId}.embla__dot--selected {
            background-color: ${settings.activeDotColor || 'hsl(var(--primary))'};
        }
        ${settings.customCss || ''}
    `;

    return (
        <div id={settings.cssId} className={cn("embla w-full relative", animationClass, responsiveClasses, settings.cssClasses)} {...customAttributes}>
            <style>{dynamicStyles}</style>
            <div className={cn("embla__viewport", arrowPosition === 'outside' && 'overflow-visible')} ref={emblaRef}>
                <div className="embla__container" style={{ marginLeft: `-${spacing / 2}px`, marginRight: `-${spacing / 2}px` }}>
                    {images.map((image, index) => (
                        <div className={cn("embla__slide", `embla__slide--${uniqueId}`)} key={image.id || index}>
                            <Link href={image.link || '#'} className="group block overflow-hidden" target={image.link ? '_blank' : undefined} rel="noopener noreferrer">
                                <div className="relative aspect-video">
                                    <Image
                                        className={cn("transition-transform", hoverClass, shadowClass)}
                                        style={{
                                            borderRadius: settings.borderRadius ? `${settings.borderRadius}px` : undefined,
                                            border: settings.border?.type !== 'none' ? `${settings.border?.width || 1}px ${settings.border?.type || 'solid'} ${settings.border?.color || '#000'}` : undefined,
                                            transitionDuration: settings.transitionDuration ? `${settings.transitionDuration}s` : undefined
                                        }}
                                        src={image.src || 'https://placehold.co/800x450.png'}
                                        alt={image.caption || 'Carousel image'}
                                        layout="fill"
                                        objectFit={settings.imageStretch ? 'cover' : 'contain'}
                                        data-ai-hint="carousel image"
                                    />
                                </div>
                                {image.caption && <p className="mt-2 text-sm text-center">{image.caption}</p>}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
            
            {(navigation === 'arrows' || navigation === 'arrows_dots') && (
                <>
                    <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} className={cn(`embla__button--${uniqueId}`, arrowPosition === 'outside' && '-left-16')} />
                    <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} className={cn(`embla__button--${uniqueId}`, arrowPosition === 'outside' && '-right-16')} />
                </>
            )}

             {(navigation === 'dots' || navigation === 'arrows_dots') && (
                 <div className="embla__dots">
                    {scrollSnaps.map((_, index) => (
                        <DotButton
                            key={index}
                            onClick={() => onDotButtonClick(index)}
                            className={cn('embla__dot', `embla__dot--${uniqueId}`, index === selectedIndex && 'embla__dot--selected')}
                        />
                    ))}
                </div>
             )}
        </div>
    );
};
