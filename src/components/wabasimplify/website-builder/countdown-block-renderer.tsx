

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CountdownBlockRendererProps {
  settings: {
    endDate?: string;
    showLabels?: boolean;
    labels?: {
      days?: string;
      hours?: string;
      minutes?: string;
      seconds?: string;
    };
    actionOnEnd?: 'hide' | 'showMessage' | 'redirect';
    endMessage?: string;
    redirectUrl?: string;
    
    // Style
    digitColor?: string;
    digitBgColor?: string;
    digitFontFamily?: string;
    digitBorderRadius?: number;
    digitPadding?: number;

    labelColor?: string;
    labelSpacing?: number;

    // Advanced
    margin?: { top?: number; bottom?: number; left?: number; right?: number };
    animation?: string;
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

const calculateTimeLeft = (endDate: string) => {
    const difference = +new Date(endDate) - +new Date();
    let timeLeft = {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    };

    if (difference > 0) {
        timeLeft = {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60)
        };
    }
    return timeLeft;
};

const TimeUnit = ({ value, label, settings }: { value: number; label: string; settings: CountdownBlockRendererProps['settings'] }) => {
    const digitStyle: React.CSSProperties = {
        color: settings.digitColor || '#000000',
        backgroundColor: settings.digitBgColor || '#FFFFFF',
        fontFamily: settings.digitFontFamily || 'monospace',
        borderRadius: settings.digitBorderRadius ? `${settings.digitBorderRadius}px` : undefined,
        padding: settings.digitPadding ? `${settings.digitPadding}px` : undefined,
    };
    const labelStyle: React.CSSProperties = {
        color: settings.labelColor || '#64748b',
        marginTop: settings.labelSpacing ? `${settings.labelSpacing}px` : undefined,
    };
    return (
        <div className="text-center">
            <div className="text-5xl font-bold p-4 rounded-lg" style={digitStyle}>{String(value).padStart(2, '0')}</div>
            {settings.showLabels !== false && <div className="text-sm uppercase mt-2" style={labelStyle}>{label}</div>}
        </div>
    );
}

export const CountdownBlockRenderer: React.FC<CountdownBlockRendererProps> = ({ settings }) => {
    const { 
        endDate,
        labels = { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
        actionOnEnd = 'hide',
        endMessage,
        redirectUrl,
        animation,
        responsiveVisibility,
        margin,
        cssId,
        cssClasses,
        customCss,
        customAttributes
    } = settings;

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(endDate || ''));
    const [isFinished, setIsFinished] = useState(false);
    const router = useRouter();

    const timerCallback = useCallback(() => {
        const newTimeLeft = calculateTimeLeft(endDate || '');
        setTimeLeft(newTimeLeft);
        if (newTimeLeft.days === 0 && newTimeLeft.hours === 0 && newTimeLeft.minutes === 0 && newTimeLeft.seconds === 0) {
            setIsFinished(true);
        }
    }, [endDate]);

    useEffect(() => {
        if (!endDate || isFinished) return;

        const timer = setInterval(timerCallback, 1000);
        return () => clearInterval(timer);
    }, [endDate, isFinished, timerCallback]);
    
    useEffect(() => {
        if(isFinished) {
            if(actionOnEnd === 'redirect' && redirectUrl) {
                router.push(redirectUrl);
            }
        }
    }, [isFinished, actionOnEnd, redirectUrl, router]);


    if (!endDate) {
        return (
            <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                Countdown Timer: Please set an end date.
            </div>
        );
    }
    
    if (isFinished) {
        if (actionOnEnd === 'showMessage') {
            return <div className="p-8 text-center text-2xl font-bold">{endMessage || "Time's up!"}</div>
        }
        return null;
    }

    const animationClass = {
        fadeIn: 'animate-in fade-in duration-500',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
    }[animation || 'none'];

    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': responsiveVisibility?.tablet === false,
        'max-sm:hidden': responsiveVisibility?.mobile === false,
    });
    
    const wrapperStyle: React.CSSProperties = {
        margin: margin ? `${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px` : undefined,
    };
    
    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => { if(attr.key) acc[attr.key] = attr.value; return acc; }, {});
    const customStyleTag = customCss ? (<style>{`#${cssId || ''} { ${customCss} }`}</style>) : null;

    return (
        <div id={cssId} className={cn('flex justify-center items-center gap-2 md:gap-4', animationClass, responsiveClasses, cssClasses)} style={wrapperStyle} {...customAttrs}>
            {customStyleTag}
            <TimeUnit value={timeLeft.days} label={labels.days || 'Days'} settings={settings} />
            <TimeUnit value={timeLeft.hours} label={labels.hours || 'Hours'} settings={settings} />
            <TimeUnit value={timeLeft.minutes} label={labels.minutes || 'Minutes'} settings={settings} />
            <TimeUnit value={timeLeft.seconds} label={labels.seconds || 'Seconds'} settings={settings} />
        </div>
    );
};
