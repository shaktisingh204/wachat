
'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { MapPin } from 'lucide-react';

interface MapBlockRendererProps {
  settings: {
    address?: string;
    mapType?: 'roadmap' | 'satellite';
    zoom?: number;
    width?: string;
    height?: string;
    rounded?: boolean;
  };
}

export const MapBlockRenderer: React.FC<MapBlockRendererProps> = ({ settings }) => {
    const [apiKey, setApiKey] = useState<string | undefined>(undefined);

    useEffect(() => {
        setApiKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
    }, []);

    const { 
        address = 'Eiffel Tower, Paris',
        mapType = 'roadmap',
        zoom = 14,
        width = '100%',
        height = '450px',
        rounded = true
    } = settings;

    if (apiKey === undefined) {
        // Still loading or key not found client-side
        return <Skeleton style={{ width, height }} />;
    }

    if (!apiKey) {
        return (
            <Alert variant="destructive" style={{ width, height: 'auto' }} className="flex flex-col items-center justify-center text-center">
                <MapPin className="h-6 w-6" />
                <AlertTitle>Google Maps API Key Missing</AlertTitle>
                <AlertDescription>
                    An API key is required to display this map. Please configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in your environment variables.
                </AlertDescription>
            </Alert>
        );
    }
    
    const query = encodeURIComponent(address);
    const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&maptype=${mapType}&zoom=${zoom}`;

    return (
        <div 
            style={{ width, height }}
            className={cn('overflow-hidden', rounded && 'rounded-lg')}
        >
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
