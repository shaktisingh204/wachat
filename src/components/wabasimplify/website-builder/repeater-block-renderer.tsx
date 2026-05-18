'use client';

import { ZoruCard, ZoruCardContent, ZoruCardFooter, ZoruCardHeader, ZoruCardTitle, ZoruButton } from '@/components/zoruui';
import {
  cn } from '@/lib/utils';

import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
type EmblaOptionsType = Parameters<typeof useEmblaCarousel>[0];
import Autoplay from 'embla-carousel-autoplay';
import Image from 'next/image';
import Link from 'next/link';

import { ShoppingBag } from 'lucide-react';
import { DotButton, useDotButton } from './embla-carousel-dot-button';
import { PrevButton, NextButton, usePrevNextButtons } from './embla-carousel-arrow-buttons';

type RepeaterItem = {
    id: string;
    imageUrl?: string;
    title: string;
    description?: string;
    buttonText?: string;
    buttonLink?: string;
};

interface RepeaterBlockRendererProps {
  settings: {
    items?: RepeaterItem[];
    layout?: 'list' | 'grid' | 'carousel';
    columns?: number;
    loop?: boolean;
    autoplay?: boolean;
    autoplayDelay?: number;
  };
}

const RepeaterItemCard = ({ item }: { item: RepeaterItem }) => (
    <ZoruCard className="h-full flex flex-col">
        <ZoruCardHeader className="p-0">
            {item.imageUrl ? (
                <div className="relative aspect-video">
                    <Image src={item.imageUrl} alt={item.title} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="repeater item image" />
                </div>
            ) : (
                <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center">
                    <ShoppingBag className="h-10 w-10 text-muted-foreground" />
                </div>
            )}
            <div className="p-4">
                <ZoruCardTitle className="text-lg">{item.title}</ZoruCardTitle>
            </div>
        </ZoruCardHeader>
        <ZoruCardContent className="p-4 pt-0 flex-grow">
            <p className="text-sm text-muted-foreground">{item.description}</p>
        </ZoruCardContent>
        {item.buttonText && item.buttonLink && (
            <ZoruCardFooter className="p-4 pt-0">
                <ZoruButton asChild className="w-full">
                    <Link href={item.buttonLink}>{item.buttonText}</Link>
                </ZoruButton>
            </ZoruCardFooter>
        )}
    </ZoruCard>
);

export const RepeaterBlockRenderer: React.FC<RepeaterBlockRendererProps> = ({ settings }) => {
    const { 
        items = [],
        layout = 'grid',
        columns = 3,
        loop = false,
        autoplay = false,
        autoplayDelay = 4,
    } = settings;

    const options: EmblaOptionsType = { loop, align: 'start', slidesToScroll: 1 };
    const plugins = autoplay ? [Autoplay({ delay: autoplayDelay * 1000, stopOnInteraction: false })] : [];
    const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);
    
    const { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(emblaApi);
    const { prevBtnDisabled, nextBtnDisabled, onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi);

    if (items.length === 0) {
        return (
            <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                Repeater Block: No items added.
            </div>
        );
    }
    
    if (layout === 'carousel') {
        return (
            <div className="embla w-full">
                <div className="embla__viewport" ref={emblaRef}>
                    <div className="embla__container">
                        {items.map((item) => (
                            <div className="embla__slide" key={item.id} style={{ flex: `0 0 calc(100% / ${columns})` }}>
                                <div className="h-full p-2">
                                    <RepeaterItemCard item={item} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="embla__controls">
                    <div className="embla__buttons">
                        <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
                        <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
                    </div>
                    <div className="embla__dots">
                        {scrollSnaps.map((_, index) => (
                        <DotButton
                            key={index}
                            onClick={() => onDotButtonClick(index)}
                            className={'embla__dot'.concat(
                            index === selectedIndex ? ' embla__dot--selected' : ''
                            )}
                        />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (layout === 'grid') {
        const gridColsClasses = {
            1: 'grid-cols-1',
            2: 'grid-cols-1 md:grid-cols-2',
            3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
            4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
            5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
            6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
        }[columns] || 'grid-cols-1 md:grid-cols-3';

        return (
            <div className={cn('grid gap-6', gridColsClasses)}>
                {items.map(item => <RepeaterItemCard key={item.id} item={item} />)}
            </div>
        );
    }
    
    // Default to list view
    return (
        <div className="flex flex-col gap-6">
            {items.map(item => <RepeaterItemCard key={item.id} item={item} />)}
        </div>
    );
};
