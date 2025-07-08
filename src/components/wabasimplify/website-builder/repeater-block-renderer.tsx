
'use client';

import React from 'react';
import useEmblaCarousel, { type EmblaOptionsType } from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    <Card className="h-full flex flex-col">
        <CardHeader className="p-0">
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
                <CardTitle className="text-lg">{item.title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-grow">
            <p className="text-sm text-muted-foreground">{item.description}</p>
        </CardContent>
        {item.buttonText && item.buttonLink && (
            <CardFooter className="p-4 pt-0">
                <Button asChild className="w-full">
                    <Link href={item.buttonLink}>{item.buttonText}</Link>
                </Button>
            </CardFooter>
        )}
    </Card>
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
        const gridClasses = {
            1: 'grid-cols-1',
            2: 'grid-cols-1 md:grid-cols-2',
            3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
            4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        }[columns] || 'grid-cols-1 md:grid-cols-3';

        return (
            <div className={cn('grid gap-6', gridClasses)}>
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
