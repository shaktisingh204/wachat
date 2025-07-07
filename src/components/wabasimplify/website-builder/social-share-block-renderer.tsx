
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Facebook, Twitter, Linkedin, MessageSquare, Send } from 'lucide-react';

interface SocialShareBlockRendererProps {
  settings: {
    platforms?: string[];
    style?: 'iconOnly' | 'withLabel';
    shape?: 'circle' | 'square' | 'rounded';
    size?: 'small' | 'medium' | 'large';
    alignment?: 'left' | 'center' | 'right';
    iconColor?: string;
    shareUrl?: string;
  };
}

// Custom SVG components for icons not in lucide-react
const PinterestIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12.5.5C6.1 1.4 2.3 6.6.5 12c-2.3 7 1.8 13.9 8.2 11.2 1-.4 1.4-1.5 1.1-2.5-.2-.8-.8-1.8-1-2.2-.3-.6-.2-1.2.2-1.7 1.2-1.3 2.1-3.2 2-5.3-.2-2.3-1.6-4.3-3.8-4.9C6.2 6.1 5 7.1 5 8.9c0 1.2.7 2.3 1.5 2.7.4.2.5.1.4-.2C6.3 10.5 6 9.3 6 8.5c0-1.7 1.1-3.3 3-3.6 2.2-.3 4.1 1.1 4.4 3.2.3 2.2-1.1 4.2-3 5.3-.5.5-.6 1-.4 1.6.2.6.9 1.6 1.2 2.1 1.4 2.8 5.5 1.5 6.5-1.5 1.5-4.5-1-9.9-5.7-11.8z" />
    </svg>
);

const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M15.91 10.34a2.2 2.2 0 0 1-2.22 2.21 2.14 2.14 0 0 1-2.13-2.21 2.21 2.21 0 0 1 2.13-2.22c.9 0 1.7.54 2.22 1.34" />
      <path d="M8.2 10.34a2.2 2.2 0 0 1-2.22 2.21 2.14 2.14 0 0 1-2.13-2.21A2.2 2.2 0 0 1 6 8.12c.9 0 1.7.54 2.22 1.34" />
      <path d="M16 15.5c-.5-1-1.7-1.5-4-1.5s-3.5.5-4 1.5" />
      <path d="m17.5 7.5-1-1" />
    </svg>
);

const platformIcons: { [key: string]: React.ElementType } = {
    facebook: Facebook,
    twitter: Twitter,
    linkedin: Linkedin,
    whatsapp: MessageSquare,
    telegram: Send,
    pinterest: PinterestIcon,
    reddit: RedditIcon,
};

const platformNames: { [key: string]: string } = {
    facebook: 'Facebook',
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    pinterest: 'Pinterest',
    reddit: 'Reddit',
}

const getShareUrl = (platform: string, url: string, text: string) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);
    switch (platform) {
        case 'facebook':
            return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        case 'twitter':
            return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
        case 'linkedin':
            return `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedText}`;
        case 'whatsapp':
            return `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
        case 'telegram':
            return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        case 'pinterest':
            return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`;
        case 'reddit':
            return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
        default:
            return '#';
    }
};

export const SocialShareBlockRenderer: React.FC<SocialShareBlockRendererProps> = ({ settings }) => {
    const { 
        platforms = ['facebook', 'twitter', 'linkedin'],
        style = 'iconOnly',
        shape = 'rounded',
        size = 'medium',
        alignment = 'center',
        iconColor = '#333333',
        shareUrl
    } = settings;

    const [currentUrl, setCurrentUrl] = useState('');

    useEffect(() => {
        // window.location.href is only available on the client side
        setCurrentUrl(shareUrl || window.location.href);
    }, [shareUrl]);

    const sizeClasses = {
        small: 'h-8 w-8 text-xs',
        medium: 'h-10 w-10 text-sm',
        large: 'h-12 w-12 text-base',
    };
    
    const shapeClasses = {
        square: 'rounded-none',
        rounded: 'rounded-md',
        circle: 'rounded-full',
    };
    
    const alignmentClasses = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end',
    };
    
    const buttonSize = style === 'withLabel' ? size : 'icon';
    const buttonBaseClass = style === 'withLabel' ? {small: 'px-3 py-1', medium: 'px-4 py-2', large: 'px-6 py-3'}[size] : sizeClasses[size];

    return (
        <div className={cn('w-full flex gap-2', alignmentClasses[alignment])}>
            {platforms.map(platform => {
                const Icon = platformIcons[platform];
                if (!Icon) return null;
                return (
                    <Button
                        key={platform}
                        variant="outline"
                        className={cn('flex items-center gap-2', buttonBaseClass, shapeClasses[shape])}
                        style={{ color: iconColor, borderColor: iconColor }}
                        onClick={() => window.open(getShareUrl(platform, currentUrl, document.title), '_blank', 'noopener,noreferrer')}
                    >
                        <Icon className="h-4 w-4"/>
                        {style === 'withLabel' && <span>{platformNames[platform]}</span>}
                    </Button>
                )
            })}
        </div>
    );
};
