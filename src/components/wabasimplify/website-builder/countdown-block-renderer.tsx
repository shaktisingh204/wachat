
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CountdownBlockRendererProps {
  settings: {
    endDate?: string;
    labels?: {
      days?: string;
      hours?: string;
      minutes?: string;
      seconds?: string;
    };
    style?: 'digital' | 'circle';
    actionOnEnd?: 'hide' | 'showMessage' | 'redirect';
    endMessage?: string;
    redirectUrl?: string;
    backgroundColor?: string;
    textColor?: string;
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

const TimeUnit = ({ value, label, style, textColor }: { value: number; label: string; style: 'digital' | 'circle', textColor?: string }) => {
    if (style === 'circle') {
        return (
            <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <span className="text-4xl font-bold" style={{ color: textColor }}>{String(value).padStart(2, '0')}</span>
                </div>
                <span className="mt-2 text-sm uppercase" style={{ color: textColor }}>{label}</span>
            </div>
        );
    }
    // Digital style
    return (
        <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur-sm">
            <div className="text-5xl font-bold" style={{ color: textColor }}>{String(value).padStart(2, '0')}</div>
            <div className="text-sm uppercase" style={{ color: textColor }}>{label}</div>
        </div>
    );
}

export const CountdownBlockRenderer: React.FC<CountdownBlockRendererProps> = ({ settings }) => {
    const { 
        endDate,
        labels = { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
        style = 'digital',
        actionOnEnd = 'hide',
        endMessage,
        redirectUrl,
        backgroundColor,
        textColor
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
            return <div className="p-8 text-center text-2xl font-bold" style={{backgroundColor, color: textColor}}>{endMessage || "Time's up!"}</div>
        }
        return null; // 'hide' is the default
    }

    const gridCols = style === 'circle' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-4';

    return (
        <div className="p-8 rounded-lg" style={{backgroundColor}}>
             <div className={`grid ${gridCols} gap-4 md:gap-8 max-w-2xl mx-auto`}>
                <TimeUnit value={timeLeft.days} label={labels.days || 'Days'} style={style} textColor={textColor} />
                <TimeUnit value={timeLeft.hours} label={labels.hours || 'Hours'} style={style} textColor={textColor} />
                <TimeUnit value={timeLeft.minutes} label={labels.minutes || 'Minutes'} style={style} textColor={textColor} />
                <TimeUnit value={timeLeft.seconds} label={labels.seconds || 'Seconds'} style={style} textColor={textColor} />
            </div>
        </div>
    );
};
