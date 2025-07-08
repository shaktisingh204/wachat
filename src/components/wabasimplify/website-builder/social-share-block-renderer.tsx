
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Facebook, Twitter, Linkedin, MessageSquare, Send, Mail, Printer } from 'lucide-react';

const PinterestIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.5.5C6.1 1.4 2.3 6.6.5 12c-2.3 7 1.8 13.9 8.2 11.2 1-.4 1.4-1.5 1.1-2.5-.2-.8-.8-1.8-1-2.2-.3-.6-.2-1.2.2-1.7 1.2-1.3 2.1-3.2 2-5.3-.2-2.3-1.6-4.3-3.8-4.9C6.2 6.1 5 7.1 5 8.9c0 1.2.7 2.3 1.5 2.7.4.2.5.1.4-.2C6.3 10.5 6 9.3 6 8.5c0-1.7 1.1-3.3 3-3.6 2.2-.3 4.1 1.1 4.4 3.2.3 2.2-1.1 4.2-3 5.3-.5.5-.6 1-.4 1.6.2.6.9 1.6 1.2 2.1 1.4 2.8 5.5 1.5 6.5-1.5 1.5-4.5-1-9.9-5.7-11.8z" />
    </svg>
);

const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path fill="#FFF" d="M15.91 10.34a2.2 2.2 0 0 1-2.22 2.21 2.14 2.14 0 0 1-2.13-2.21 2.21 2.21 0 0 1 2.13-2.22c.9 0 1.7.54 2.22 1.34" />
      <path fill="#FFF" d="M8.2 10.34a2.2 2.2 0 0 1-2.22 2.21 2.14 2.14 0 0 1-2.13-2.21A2.2 2.2 0 0 1 6 8.12c.9 0 1.7.54 2.22 1.34" />
      <path fill="#FFF" d="M16 15.5c-.5-1-1.7-1.5-4-1.5s-3.5.5-4 1.5" />
      <path fill="#FFF" d="m17.5 7.5-1-1" />
    </svg>
);

const platformData: { [key: string]: { icon: React.ElementType, name: string } } = {
    facebook: { icon: Facebook, name: 'Facebook' },
    twitter: { icon: Twitter, name: 'X (Twitter)' },
    linkedin: { icon: Linkedin, name: 'LinkedIn' },
    whatsapp: { icon: MessageSquare, name: 'WhatsApp' },
    telegram: { icon: Send, name: 'Telegram' },
    pinterest: { icon: PinterestIcon, name: 'Pinterest' },
    reddit: { icon: RedditIcon, name: 'Reddit' },
    email: { icon: Mail, name: 'Email' },
    print: { icon: Printer, name: 'Print' },
};

const getShareUrl = (platform: string, url: string, text: string) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    switch (platform) {
        case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        case 'twitter': return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        case 'linkedin': return `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedText}`;
        case 'whatsapp': return `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
        case 'telegram': return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        case 'pinterest': return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`;
        case 'reddit': return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
        case 'email': return `mailto:?subject=${encodedText}&body=${encodedUrl}`;
        case 'print': return 'javascript:window.print()';
        default: return '#';
    }
};

interface SocialShareBlockRendererProps {
  settings: any;
}

export const SocialShareBlockRenderer: React.FC<SocialShareBlockRendererProps> = ({ settings }) => {
    const { 
        platforms = ['facebook', 'twitter', 'linkedin'],
        style = 'iconOnly',
        shape = 'rounded',
        size = 'medium',
        alignment = 'center',
        color,
        backgroundColor,
        hoverColor,
        hoverBackgroundColor,
        iconSize = 16,
        gap = 8,
        columns = 0,
        urlType = 'currentPage',
        customUrl,
    } = settings;

    const [currentUrl, setCurrentUrl] = useState('');
    const [pageTitle, setPageTitle] = useState('');

    useEffect(() => {
        setCurrentUrl(urlType === 'custom' && customUrl ? customUrl : window.location.href);
        setPageTitle(document.title);
    }, [urlType, customUrl]);

    const buttonSizeClasses = { small: 'h-8 px-2', medium: 'h-10 px-3', large: 'h-12 px-4'}[size];
    const iconSizeClasses = { small: 'h-4 w-4', medium: 'h-5 w-5', large: 'h-6 w-6'}[size];
    
    const shapeClasses = { square: 'rounded-none', rounded: 'rounded-md', circle: 'rounded-full' };
    
    const alignmentClasses = {
        left: 'justify-start', center: 'justify-center', right: 'justify-end',
        justify: 'w-full [&>*]:flex-1',
    };
    
    const gridColsClass = {
        0: 'grid-cols-none', 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
        4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
    }[columns];

    const uniqueId = React.useId().replace(/:/g, "");
    
    const customStyleTag = (
        <style>{`
            .social-btn--${uniqueId} {
                background-color: ${backgroundColor || 'transparent'};
                border-color: ${backgroundColor || color};
            }
            .social-btn--${uniqueId} .icon, .social-btn--${uniqueId} .label {
                color: ${color || 'currentColor'};
            }
            .social-btn--${uniqueId}:hover {
                 background-color: ${hoverBackgroundColor || backgroundColor || 'transparent'};
                 border-color: ${hoverBackgroundColor || hoverColor || color};
            }
             .social-btn--${uniqueId}:hover .icon, .social-btn--${uniqueId}:hover .label {
                color: ${hoverColor || color};
            }
        `}</style>
    );

    return (
        <>
            {customStyleTag}
            <div className={cn('flex flex-wrap', alignmentClasses[alignment])} style={{ gap: `${gap}px` }}>
                <div className={cn('grid w-full', gridColsClass)} style={{ gap: `${gap}px` }}>
                    {platforms.map((platform: string) => {
                        const Icon = platformData[platform]?.icon;
                        if (!Icon) return null;
                        
                        const buttonContent = (
                            <>
                                <Icon className={cn('icon', iconSizeClasses)} style={{ fontSize: `${iconSize}px` }}/>
                                {style === 'withLabel' && <span className="label">{platformData[platform].name}</span>}
                            </>
                        );

                        const shareUrl = getShareUrl(platform, currentUrl, pageTitle);
                        
                        return (
                            <Button
                                key={platform}
                                asChild
                                variant="outline"
                                className={cn('flex items-center gap-2 social-btn', `social-btn--${uniqueId}`, buttonSizeClasses, shapeClasses[shape])}
                            >
                                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                                    {buttonContent}
                                </a>
                            </Button>
                        )
                    })}
                </div>
            </div>
        </>
    );
};
