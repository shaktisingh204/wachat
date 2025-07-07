
'use client';

import React from 'react';
import useEmblaCarousel, { type EmblaOptionsType } from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Image from 'next/image';
import Link from 'next/link';
import { DotButton, useDotButton } from './embla-carousel-dot-button';
import { PrevButton, NextButton, usePrevNextButtons } from './embla-carousel-arrow-buttons';

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
    autoplay?: boolean;
    autoplayDelay?: number;
    loop?: boolean;
    showArrows?: boolean;
    showDots?: boolean;
    hoverEffect?: 'none' | 'zoom' | 'grayscale';
    transitionEffect?: 'slide' | 'fade'; // Fade is more complex, will stick to slide for now.
  };
}

export const ImageCarouselRenderer: React.FC<ImageCarouselRendererProps> = ({ settings }) => {
  const options: EmblaOptionsType = {
    loop: settings.loop || false,
    align: 'start',
    slidesToScroll: 1,
  };
  
  const plugins = settings.autoplay ? [Autoplay({ delay: (settings.autoplayDelay || 4) * 1000, stopOnInteraction: false })] : [];

  const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);
  
  const { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(emblaApi);
  const { prevBtnDisabled, nextBtnDisabled, onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi);
  
  const images = settings.images || [];

  if (images.length === 0) {
    return (
      <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
        <p>No images in carousel</p>
      </div>
    );
  }

  return (
    <div className="embla">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {images.map((image) => (
            <div className="embla__slide group" key={image.id}>
              {image.link ? (
                <Link href={image.link} target="_blank" rel="noopener noreferrer">
                  <Image
                    className="embla__slide__img rounded-lg shadow-md"
                    src={image.src || 'https://placehold.co/800x450.png'}
                    alt={image.caption || 'Carousel image'}
                    width={800}
                    height={450}
                    data-ai-hint="carousel image"
                  />
                </Link>
              ) : (
                <Image
                  className="embla__slide__img rounded-lg shadow-md"
                  src={image.src || 'https://placehold.co/800x450.png'}
                  alt={image.caption || 'Carousel image'}
                  width={800}
                  height={450}
                  data-ai-hint="carousel image"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      
       {(settings.showArrows || settings.showDots) && (
        <div className="embla__controls">
          <div className="embla__buttons">
            {settings.showArrows && (
                <>
                    <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
                    <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
                </>
            )}
          </div>

          <div className="embla__dots">
             {settings.showDots && scrollSnaps.map((_, index) => (
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
      )}
    </div>
  );
};
