
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CountdownBlockRendererProps {
  settings: {
    // Content
    countdownType?: 'dueDate' | 'evergreen';
    endDate?: string;
    timeZone?: 'user' | 'server';
    evergreenDuration?: { days?: number, hours?: number, minutes?: number };
    actionOnEnd?: 'hide' | 'showMessage' | 'redirect';
    endMessage?: string;
    redirectUrl?: string;
    showLabels?: boolean;
    labels?: { days?: string, hours?: string, minutes?: string, seconds?: string };
    showSeparators?: boolean;
    htmlTag?: string;
    
    // Style
    alignment?: 'left' | 'center' | 'right';
    digitColor?: string;
    digitBgColor?: string;
    digitFontFamily?: string;
    digitBorderRadius?: number;
    digitPadding?: number;
    digitBorder?: { type?: string, width?: number, color?: string };
    digitBoxShadow?: string;

    labelColor?: string;
    labelFontFamily?: string;
    labelSpacing?: number;

    separatorColor?: string;
    separatorSize?: number;

    // Advanced
    margin?: { top?: number; bottom?: number; left?: number; right?: number };
    padding?: { top?: number; bottom?: number; left?: number; right?: number };
    animation?: string;
    animationDuration?: string;
    animationDelay?: number;
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    tabletAlign?: 'left' | 'center' | 'right';
    mobileAlign?: 'left' | 'center' | 'right';
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
    zIndex?: number;
  };
}

const TimeUnit = ({ value, label, settings }: { value: number; label: string; settings: CountdownBlockRendererProps['settings'] }) => {
    const digitStyle: React.CSSProperties = {
        color: settings.digitColor || '#000000',
        backgroundColor: settings.digitBgColor || '#FFFFFF',
        fontFamily: settings.digitFontFamily || 'monospace',
        borderRadius: settings.digitBorderRadius ? `${settings.digitBorderRadius}px` : undefined,
        padding: settings.digitPadding ? `${settings.digitPadding}px` : undefined,
        border: settings.digitBorder?.type !== 'none' ? `${settings.digitBorder?.width || 1}px ${settings.digitBorder?.type || 'solid'} ${settings.digitBorder?.color || '#e5e7eb'}` : 'none',
        boxShadow: { sm: 'var(--tw-shadow-sm)', md: 'var(--tw-shadow-md)', lg: 'var(--tw-shadow-lg)' }[settings.digitBoxShadow || 'none'],
    };
    const labelStyle: React.CSSProperties = {
        color: settings.labelColor || '#64748b',
        fontFamily: settings.labelFontFamily,
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
        countdownType = 'dueDate',
        endDate,
        timeZone = 'user',
        evergreenDuration,
        labels = { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
        showSeparators = true,
        actionOnEnd = 'hide',
        endMessage,
        redirectUrl,
        alignment, tabletAlign, mobileAlign,
        separatorColor, separatorSize,
        animation, animationDuration, animationDelay,
        responsiveVisibility,
        margin, padding, cssId, cssClasses, customCss, customAttributes, htmlTag, zIndex
    } = settings;

    const getEndDate = useCallback(() => {
        if (typeof window === 'undefined') return null; // Can't use localStorage on server

        if (countdownType === 'evergreen') {
            const timerId = `evergreen-timer-${cssId || settings.id}`;
            const storedEndTime = localStorage.getItem(timerId);
            if (storedEndTime) {
                return new Date(parseInt(storedEndTime, 10));
            } else {
                const now = new Date();
                const durationMs = ((evergreenDuration?.days || 0) * 24 * 60 * 60 +
                                    (evergreenDuration?.hours || 0) * 60 * 60 +
                                    (evergreenDuration?.minutes || 0) * 60) * 1000;
                const newEndTime = now.getTime() + durationMs;
                localStorage.setItem(timerId, String(newEndTime));
                return new Date(newEndTime);
            }
        }
        
        if (!endDate) return null;
        if (timeZone === 'server') {
            return new Date(endDate + 'Z'); 
        }
        return new Date(endDate); 
    }, [countdownType, evergreenDuration, endDate, timeZone, cssId, settings.id]);

    const calculateTimeLeft = useCallback(() => {
        const targetDate = getEndDate();
        if (!targetDate) return { total: -1, days: 0, hours: 0, minutes: 0, seconds: 0 };

        const difference = targetDate.getTime() - new Date().getTime();
        let timeLeft = { total: difference, days: 0, hours: 0, minutes: 0, seconds: 0 };

        if (difference > 0) {
            timeLeft = {
                total: difference,
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return timeLeft;
    }, [getEndDate]);


    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [isFinished, setIsFinished] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const timer = setInterval(() => {
            const newTimeLeft = calculateTimeLeft();
            if (newTimeLeft.total <= 0) {
                setIsFinished(true);
                clearInterval(timer);
            } else {
                setTimeLeft(newTimeLeft);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [calculateTimeLeft]);
    
    useEffect(() => {
        if(isFinished) {
            if(actionOnEnd === 'redirect' && redirectUrl) {
                router.push(redirectUrl);
            }
        }
    }, [isFinished, actionOnEnd, redirectUrl, router]);


    if (isFinished) {
        if (actionOnEnd === 'showMessage') {
            return <div className="p-8 text-center text-2xl font-bold">{endMessage || "Time's up!"}</div>
        }
        if (actionOnEnd === 'hide') {
            return null;
        }
    }

    const Tag = htmlTag || 'div';
    
    const animationClass = {
        fadeIn: 'animate-in fade-in',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5',
        zoom: 'animate-in zoom-in-75',
        bounce: 'animate-bounce',
    }[animation || 'none'];
    const durationClass = { slow: 'duration-1000', normal: 'duration-500', fast: 'duration-300' }[animationDuration || 'normal'];

    const responsiveClasses = cn({
        'max-lg:hidden': responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': responsiveVisibility?.tablet === false,
        'max-sm:hidden': responsiveVisibility?.mobile === false,
    });
    
    const alignmentClasses = cn(
        'flex',
        { 'justify-start': alignment === 'left', 'justify-center': alignment === 'center', 'justify-end': alignment === 'right' },
        { 'md:justify-start': tabletAlign === 'left', 'md:justify-center': tabletAlign === 'center', 'md:justify-end': tabletAlign === 'right' },
        { 'sm:justify-start': mobileAlign === 'left', 'sm:justify-center': mobileAlign === 'center', 'sm:justify-end': mobileAlign === 'right' },
    );
    
    const wrapperStyle: React.CSSProperties = {
        margin: margin ? `${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px` : undefined,
        padding: padding ? `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px` : undefined,
        zIndex: zIndex || undefined,
        animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
    };

    const separatorStyle: React.CSSProperties = {
        color: separatorColor || '#000000',
        fontSize: separatorSize ? `${separatorSize}px` : '2.5rem',
        padding: '0 8px',
        fontWeight: 'bold',
        display: showSeparators === false ? 'none' : 'block'
    };
    
    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => { if(attr.key) acc[attr.key] = attr.value; return acc; }, {});
    const customStyleTag = customCss ? (<style>{`#${cssId || ''} { ${customCss} }`}</style>) : null;

    return (
        <Tag id={cssId} className={cn('w-full', alignmentClasses, animationClass, durationClass, responsiveClasses, cssClasses)} style={wrapperStyle} {...customAttrs}>
            {customStyleTag}
            <TimeUnit value={timeLeft.days} label={labels.days || 'Days'} settings={settings} />
            <span style={separatorStyle}>:</span>
            <TimeUnit value={timeLeft.hours} label={labels.hours || 'Hours'} settings={settings} />
            <span style={separatorStyle}>:</span>
            <TimeUnit value={timeLeft.minutes} label={labels.minutes || 'Minutes'} settings={settings} />
            <span style={separatorStyle}>:</span>
            <TimeUnit value={timeLeft.seconds} label={labels.seconds || 'Seconds'} settings={settings} />
        </Tag>
    );
};
