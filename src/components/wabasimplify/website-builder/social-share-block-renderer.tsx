
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Facebook, Twitter, Linkedin, MessageSquare, Send, Pinterest, Reddit } from 'lucide-react';

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

const platformIcons: { [key: string]: React.ElementType } = {
    facebook: Facebook,
    twitter: Twitter,
    linkedin: Linkedin,
    whatsapp: MessageSquare,
    telegram: Send,
    pinterest: Pinterest,
    reddit: Reddit,
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
