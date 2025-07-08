
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface VideoBlockRendererProps {
  settings: {
    sourceUrl?: string;
    autoPlay?: boolean;
    controls?: boolean;
    muted?: boolean;
    aspectRatio?: '16:9' | '4:3' | '1:1';
    coverImageUrl?: string;
    playIconColor?: string;
    playIconSize?: number;
    shadow?: boolean;
    border?: {
      width?: number;
      color?: string;
      radius?: number;
    };
    layout?: {
        width?: string;
        height?: string;
    }
  };
}

export const VideoBlockRenderer: React.FC<VideoBlockRendererProps> = ({ settings }) => {
    const { 
        sourceUrl, 
        autoPlay, 
        controls = true, 
        muted = true, 
        aspectRatio, 
        coverImageUrl, 
        playIconColor, 
        playIconSize,
        shadow,
        border,
        layout = {}
    } = settings;

    const getEmbedUrl = () => {
        if (!sourceUrl) return null;
        try {
            const url = new URL(sourceUrl);
            if (url.hostname.includes('youtube.com')) {
                const videoId = url.searchParams.get('v');
                return `https://www.youtube.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}&controls=${controls ? 1 : 0}&mute=${muted ? 1 : 0}`;
            }
            if (url.hostname.includes('vimeo.com')) {
                const videoId = url.pathname.split('/').pop();
                return `https://player.vimeo.com/video/${videoId}?autoplay=${autoPlay ? 1 : 0}&controls=${controls ? 1 : 0}&muted=${muted ? 1 : 0}`;
            }
        } catch (e) { /* Invalid URL, fallback to direct player */ }
        return sourceUrl; // Assume direct MP4 link
    };

    const embedUrl = getEmbedUrl();
    const isEmbed = embedUrl && (embedUrl.includes('youtube') || embedUrl.includes('vimeo'));

    const aspectClass = {
        '16:9': 'aspect-video',
        '4:3': 'aspect-[4/3]',
        '1:1': 'aspect-square',
    }[aspectRatio || '16:9'];
    
    const wrapperStyle: React.CSSProperties = {
        width: layout.width || '100%',
        height: layout.height || undefined,
        boxShadow: shadow ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none',
        border: border?.width ? `${border.width}px solid ${border.color || '#000'}` : 'none',
        borderRadius: `${border?.radius || 8}px`
    };

    return (
        <div className={cn('relative overflow-hidden', aspectClass)} style={wrapperStyle}>
            {isEmbed ? (
                <iframe
                    src={embedUrl!}
                    title="Embedded Video"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                ></iframe>
            ) : (
                <video
                    src={sourceUrl}
                    controls={controls}
                    autoPlay={autoPlay}
                    muted={muted}
                    poster={coverImageUrl}
                    className="w-full h-full object-cover"
                >
                    Your browser does not support the video tag.
                </video>
            )}
        </div>
    );
};
