
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface VideoBlockRendererProps {
  settings: {
    sourceUrl?: string;
    autoPlay?: boolean;
    loop?: boolean;
    controls?: boolean;
    muted?: boolean;
    playsInline?: boolean;
    lazyLoad?: boolean;
    startTime?: number;
    endTime?: number;
    aspectRatio?: '16:9' | '4:3' | '1:1' | '9:16';
    coverImageUrl?: string;
    opacity?: number;
    filter?: { blur?: number, brightness?: number, contrast?: number, saturate?: number };
    hoverAnimation?: 'none' | 'zoom' | 'grow';
    shadow?: 'sm' | 'md' | 'lg';
    border?: {
      width?: number;
      color?: string;
      radius?: number;
      type?: 'solid' | 'dashed' | 'dotted';
    };
    layout?: {
        width?: string;
        height?: string;
    };
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    animation?: 'none' | 'fadeIn' | 'fadeInUp' | 'zoom' | 'bounce';
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

export const VideoBlockRenderer: React.FC<VideoBlockRendererProps> = ({ settings }) => {
    const { 
        sourceUrl, 
        autoPlay,
        loop,
        controls = true, 
        muted = true, 
        playsInline,
        lazyLoad = true,
        startTime,
        endTime,
        aspectRatio, 
        coverImageUrl,
        opacity,
        filter,
        hoverAnimation,
        shadow,
        border,
        layout = {},
        responsiveVisibility,
        animation,
        cssId,
        cssClasses,
        customCss,
        customAttributes
    } = settings;

    const getEmbedUrl = () => {
        if (!sourceUrl) return null;
        try {
            const url = new URL(sourceUrl);
            let embedParams = new URLSearchParams();
            if(autoPlay) embedParams.set('autoplay', '1');
            if(!controls) embedParams.set('controls', '0');
            if(muted) embedParams.set('mute', '1');
            if(loop) embedParams.set('loop', '1');
            if(startTime) embedParams.set('start', String(startTime));

            if (url.hostname.includes('youtube.com')) {
                const videoId = url.searchParams.get('v');
                if (endTime) embedParams.set('end', String(endTime));
                if (loop) embedParams.set('playlist', videoId!); // YouTube loop needs playlist param
                return `https://www.youtube.com/embed/${videoId}?${embedParams.toString()}`;
            }
            if (url.hostname.includes('vimeo.com')) {
                const videoId = url.pathname.split('/').pop();
                 return `https://player.vimeo.com/video/${videoId}?${embedParams.toString()}`;
            }
        } catch (e) { /* Invalid URL, fallback to direct player */ }
        
        // Self-hosted with time fragments
        let selfHostedUrl = sourceUrl;
        if(startTime || endTime) {
            selfHostedUrl += '#t=';
            if(startTime) selfHostedUrl += startTime;
            if(endTime) selfHostedUrl += `,${endTime}`;
        }
        return selfHostedUrl;
    };

    const embedUrl = getEmbedUrl();
    const isEmbed = embedUrl && (embedUrl.includes('youtube') || embedUrl.includes('vimeo'));

    const aspectClass = {
        '16:9': 'aspect-video',
        '4:3': 'aspect-[4/3]',
        '1:1': 'aspect-square',
        '9:16': 'aspect-[9/16]',
    }[aspectRatio || '16:9'];
    
    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': responsiveVisibility?.tablet === false,
        'max-sm:hidden': responsiveVisibility?.mobile === false,
    });
    
    const animationClass = {
        fadeIn: 'animate-in fade-in duration-500',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
        zoom: 'animate-in zoom-in-75',
        bounce: 'animate-bounce',
    }[animation || 'none'];
    
    const hoverClass = {
        none: '',
        zoom: 'group-hover:scale-105',
        grow: 'group-hover:scale-110',
    }[hoverAnimation || 'none'];

    const shadowClass = {
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
    }[shadow || 'none'] || '';

    const wrapperStyle: React.CSSProperties = {
        width: layout.width || '100%',
        height: layout.height || undefined,
    };
    
    const playerStyle: React.CSSProperties = {
        border: border?.width ? `${border.width}px ${border.type || 'solid'} ${border.color || '#000'}` : 'none',
        borderRadius: `${border?.radius || 8}px`,
        opacity: opacity ?? 1,
        filter: [
            `blur(${filter?.blur || 0}px)`,
            `brightness(${filter?.brightness || 100}%)`,
            `contrast(${filter?.contrast || 100}%)`,
            `saturate(${filter?.saturate || 100}%)`,
        ].join(' '),
    }
    
    const customStyleTag = customCss ? (
        <style>{`#${cssId || ''} { ${customCss} }`}</style>
    ) : null;
    
    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    return (
        <div 
            id={cssId}
            className={cn('relative group', aspectClass, shadowClass, responsiveClasses, animationClass, cssClasses)} 
            style={wrapperStyle}
            {...customAttrs}
        >
            {customStyleTag}
            {isEmbed ? (
                <iframe
                    src={embedUrl!}
                    title="Embedded Video"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className={cn("w-full h-full transition-transform duration-300", hoverClass)}
                    style={playerStyle}
                    loading={lazyLoad ? 'lazy' : 'eager'}
                ></iframe>
            ) : (
                <video
                    src={sourceUrl}
                    controls={controls}
                    autoPlay={autoPlay}
                    loop={loop}
                    muted={muted}
                    playsInline={playsInline}
                    poster={coverImageUrl}
                    className={cn("w-full h-full object-cover transition-transform duration-300", hoverClass)}
                    style={playerStyle}
                    {...(lazyLoad && { loading: 'lazy' })}
                >
                    Your browser does not support the video tag.
                </video>
            )}
        </div>
    );
};
