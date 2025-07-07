
'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';

export const HeroBlock = ({ settings }: { settings: any }) => (
    <div className="relative h-96 md:h-[500px] text-white flex items-center justify-start text-left" style={{ backgroundColor: settings.backgroundColor || '#FFFFFF' }}>
        {settings.backgroundImageUrl && <Image src={settings.backgroundImageUrl} alt={settings.title || 'Banner'} layout="fill" objectFit="cover" className="opacity-90" data-ai-hint="store banner"/>}
        <div className="relative z-10 space-y-4 max-w-7xl mx-auto px-4 w-full">
            <div className="max-w-xl space-y-4">
                <p className="font-semibold text-primary" style={{color: settings.textColor || '#000000'}}>Save through easy and buy</p>
                <h1 className="text-4xl md:text-6xl font-extrabold" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#000000'}}>{settings.title || 'Designed to go places.'}</h1>
                <p className="text-lg md:text-xl text-black/80" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#000000'}}>{settings.subtitle || 'Our new collection is here'}</p>
                {settings.buttonText && <Button size="lg" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>{settings.buttonText}</Button>}
            </div>
        </div>
    </div>
);
