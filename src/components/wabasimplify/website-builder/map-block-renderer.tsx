
'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { MapPin } from 'lucide-react';

interface MapBlockRendererProps {
  settings: {
    address?: string;
    mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
    zoom?: number;
    language?: string;
    // Style
    height?: string;
    backgroundColor?: string;
    border?: { type?: string; width?: {top?: string, right?: string, bottom?: string, left?: string}; color?: string; };
    borderRadius?: {tl?: string, tr?: string, br?: string, bl?: string};
    boxShadow?: 'none' | 'sm' | 'md' | 'lg';
    // Advanced
    margin?: { top?: number; bottom?: number; left?: number; right?: number };
    padding?: { top?: number; bottom?: number; left?: number; right?: number };
    zIndex?: number;
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    tabletHeight?: string;
    mobileHeight?: string;
    animation?: string;
    animationDuration?: string;
    animationDelay?: number;
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

export const MapBlockRenderer: React.FC<MapBlockRendererProps> = ({ settings }) => {
    const [apiKey, setApiKey] = useState<string | undefined>(undefined);

    useEffect(() => {
        setApiKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
    }, []);

    const { 
        address = 'Eiffel Tower, Paris, France',
        mapType = 'roadmap',
        zoom = 14,
        language,
        height = '450px',
        backgroundColor,
        border,
        borderRadius,
        boxShadow,
        margin,
        padding,
        zIndex,
        responsiveVisibility,
        tabletHeight,
        mobileHeight,
        animation,
        animationDuration,
        animationDelay,
        cssId,
        cssClasses,
        customCss,
        customAttributes
    } = settings;

    if (apiKey === undefined) {
        return <Skeleton style={{ height }} />;
    }

    if (!apiKey) {
        return (
            <Alert variant="destructive" style={{ height: 'auto', minHeight: '200px' }} className="flex flex-col items-center justify-center text-center">
                <MapPin className="h-6 w-6" />
                <AlertTitle>Google Maps API Key Missing</AlertTitle>
                <AlertDescription>
                    Please configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in your environment variables.
                </AlertDescription>
            </Alert>
        );
    }
    
    const query = encodeURIComponent(address);
    const langParam = language ? `&language=${language}` : '';
    const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&maptype=${mapType}&zoom=${zoom}${langParam}`;

    const uniqueId = cssId || React.useId().replace(/:/g, "");

    const wrapperStyle: React.CSSProperties = {
        paddingTop: padding?.top ? `${padding.top}px` : undefined,
        paddingRight: padding?.right ? `${padding.right}px` : undefined,
        paddingBottom: padding?.bottom ? `${padding.bottom}px` : undefined,
        paddingLeft: padding?.left ? `${padding.left}px` : undefined,
        marginTop: margin?.top ? `${margin.top}px` : undefined,
        marginRight: margin?.right ? `${margin.right}px` : undefined,
        marginBottom: margin?.bottom ? `${margin.bottom}px` : undefined,
        marginLeft: margin?.left ? `${margin.left}px` : undefined,
        zIndex: zIndex || undefined,
        animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
        backgroundColor: backgroundColor,
        borderStyle: border?.type !== 'none' ? border?.type : undefined,
        borderTopWidth: border?.width?.top ? `${border.width.top}px` : undefined,
        borderRightWidth: border?.width?.right ? `${border.width.right}px` : undefined,
        borderBottomWidth: border?.width?.bottom ? `${border.width.bottom}px` : undefined,
        borderLeftWidth: border?.width?.left ? `${border.width.left}px` : undefined,
        borderColor: border?.color,
        borderRadius: borderRadius ? `${borderRadius.tl || 0}px ${borderRadius.tr || 0}px ${borderRadius.br || 0}px ${borderRadius.bl || 0}px` : undefined,
        boxShadow: { sm: 'var(--tw-shadow-sm)', md: 'var(--tw-shadow-md)', lg: 'var(--tw-shadow-lg)'}[boxShadow || 'none'],
        '--map-height': height,
        '--map-tablet-height': tabletHeight,
        '--map-mobile-height': mobileHeight,
    } as React.CSSProperties;
    
    const animationClass = {
        fadeIn: 'animate-in fade-in',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5',
    }[animation || 'none'];
    
    const animationDurationClass = { slow: 'duration-1000', normal: 'duration-500', fast: 'duration-300' }[animationDuration || 'normal'];
    
    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:block': responsiveVisibility?.tablet !== false,
        'max-sm:hidden': responsiveVisibility?.mobile === false,
    });
    
    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});
    
    const customStyleTag = (
        <style>{`
            #map-wrapper-${uniqueId} { height: var(--map-height); }
            @media (max-width: 1024px) { #map-wrapper-${uniqueId} { height: var(--map-tablet-height, var(--map-height)); } }
            @media (max-width: 768px) { #map-wrapper-${uniqueId} { height: var(--map-mobile-height, var(--map-tablet-height, var(--map-height))); } }
            ${customCss || ''}
        `}</style>
    );

    return (
        <div 
            id={`map-wrapper-${uniqueId}`}
            style={wrapperStyle}
            className={cn('overflow-hidden', animationClass, durationClass, responsiveClasses, cssClasses)}
            {...customAttrs}
        >
            {customStyleTag}
             <iframe
                title={`Map of ${address}`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={src}>
            </iframe>
        </div>
    );
};
