
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
    
    // Style props
    spacing?: number;
    border?: { type?: string; width?: {top?: string, right?: string, bottom?: string, left?: string}, color?: string };
    borderRadius?: {tl?: string, tr?: string, br?: string, bl?: string};
    boxShadow?: 'none' | 'sm' | 'md' | 'lg';
    hoverAnimation?: string;
    filter?: { blur?: number, brightness?: number, contrast?: number, saturate?: number, hue?: number };
    hoverFilter?: { blur?: number, brightness?: number, contrast?: number, saturate?: number, hue?: number };
    transitionDuration?: number;

    arrowPosition?: 'inside' | 'outside';
    arrowSize?: number;
    arrowColor?: string;
    arrowBgColor?: string;
    arrowHoverColor?: string;
    arrowHoverBgColor?: string;
    arrowBorderRadius?: number;

    dotPosition?: 'outside' | 'inside';
    dotSize?: number;
    dotSpacing?: number;
    dotAlignment?: 'flex-start' | 'center' | 'flex-end';
    dotColor?: string;
    activeDotColor?: string;
    
    // Advanced
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    animation?: 'none' | 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'fadeInLeft' | 'fadeInRight';
    animationDuration?: 'slow' | 'normal' | 'fast';
    animationDelay?: number;
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
    
    const hoverClass = settings.hoverAnimation && settings.hoverAnimation !== 'none' ? `group-hover:${settings.hoverAnimation}` : '';
    const shadowClass = { sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg'}[settings.boxShadow || 'none'] || 'shadow-none';

    const animationDurationClass = { slow: 'duration-1000', normal: 'duration-500', fast: 'duration-300'}[settings.animationDuration || 'normal'];
    const animationClass = settings.animation && settings.animation !== 'none' ? `animate-in ${settings.animation} ${animationDurationClass}` : '';
    
    const responsiveClasses = cn({
        'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const customAttributes = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});
    
    const uniqueId = React.useId().replace(/:/g, "");

    const getFilterString = (filter: any) => {
        if (!filter) return 'none';
        return `blur(${filter.blur || 0}px) brightness(${filter.brightness || 100}%) contrast(${filter.contrast || 100}%) saturate(${filter.saturate || 100}%) hue-rotate(${filter.hue || 0}deg)`;
    };

    const dynamicStyles = `
        .embla--${uniqueId} .embla__slide {
            flex: 0 0 ${100 / slidesToShow}%;
            min-width: 0;
            padding-left: ${spacing / 2}px;
            padding-right: ${spacing / 2}px;
        }
        .embla--${uniqueId} .embla__button {
            width: ${settings.arrowSize || 40}px;
            height: ${settings.arrowSize || 40}px;
            background-color: ${settings.arrowBgColor || 'rgba(0,0,0,0.5)'};
            border-radius: ${settings.arrowBorderRadius || 50}%;
        }
         .embla--${uniqueId} .embla__button:hover {
            background-color: ${settings.arrowHoverBgColor || 'rgba(0,0,0,0.8)'};
         }
        .embla--${uniqueId} .embla__button__svg {
            width: 50%;
            height: 50%;
            color: ${settings.arrowColor || '#ffffff'};
        }
        .embla--${uniqueId} .embla__button:hover .embla__button__svg {
            color: ${settings.arrowHoverColor || '#ffffff'};
        }
        .embla--${uniqueId} .embla__dots {
            justify-content: ${settings.dotAlignment || 'center'};
            gap: ${settings.dotSpacing || 8}px;
            ${settings.dotPosition === 'inside' ? 'position: absolute; bottom: 1rem; left: 0; right: 0;' : 'margin-top: 1rem;'}
        }
        .embla--${uniqueId} .embla__dot {
            width: ${settings.dotSize || 12}px;
            height: ${settings.dotSize || 12}px;
            background-color: ${settings.dotColor || 'hsla(0, 0%, 100%, 0.3)'};
        }
        .embla--${uniqueId} .embla__dot--selected {
            background-color: ${settings.activeDotColor || 'hsl(var(--primary))'};
        }
        .image--${uniqueId} {
            filter: ${getFilterString(settings.filter)};
            transition: filter ${settings.transitionDuration || 0.3}s ease-in-out;
        }
        .group:hover .image--${uniqueId} {
            filter: ${getFilterString(settings.hoverFilter)};
        }
        ${settings.customCss || ''}
    `;

    return (
        <div id={settings.cssId} className={cn("embla", `embla--${uniqueId}`, "w-full relative", animationClass, responsiveClasses, settings.cssClasses)} {...customAttributes}>
            <style>{dynamicStyles}</style>
            <div className={cn("embla__viewport", arrowPosition === 'outside' && 'overflow-visible')} ref={emblaRef}>
                <div className="embla__container" style={{ marginLeft: `-${spacing / 2}px`, marginRight: `-${spacing / 2}px` }}>
                    {images.map((image, index) => (
                        <div className="embla__slide" key={image.id || index}>
                            <Link href={image.link || '#'} className="group block overflow-hidden" target={image.link ? '_blank' : undefined} rel="noopener noreferrer">
                                <div className="relative aspect-video">
                                    <Image
                                        className={cn("transition-transform", `image--${uniqueId}`, hoverClass, shadowClass)}
                                        style={{
                                            borderTopWidth: `${settings.border?.width?.top || 0}px`,
                                            borderRightWidth: `${settings.border?.width?.right || 0}px`,
                                            borderBottomWidth: `${settings.border?.width?.bottom || 0}px`,
                                            borderLeftWidth: `${settings.border?.width?.left || 0}px`,
                                            borderStyle: settings.border?.type,
                                            borderColor: settings.border?.color,
                                            borderRadius: `${settings.borderRadius?.tl || 0}px ${settings.borderRadius?.tr || 0}px ${settings.borderRadius?.br || 0}px ${settings.borderRadius?.bl || 0}px`,
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
                    <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} className={cn(arrowPosition === 'outside' && '-left-16')} />
                    <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} className={cn(arrowPosition === 'outside' && '-right-16')} />
                </>
            )}

             {(navigation === 'dots' || navigation === 'arrows_dots') && (
                 <div className="embla__dots">
                    {scrollSnaps.map((_, index) => (
                        <DotButton
                            key={index}
                            onClick={() => onDotButtonClick(index)}
                            className={cn('embla__dot', index === selectedIndex && 'embla__dot--selected')}
                        />
                    ))}
                </div>
             )}
        </div>
    );
};
