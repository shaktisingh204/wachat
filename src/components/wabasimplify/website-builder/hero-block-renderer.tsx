
'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';

export const HeroBlock = ({ settings }: { settings: any }) => (
    <div className="relative h-80 md:h-96 text-white rounded-lg overflow-hidden flex items-center justify-center text-center p-4" style={{ backgroundColor: settings.backgroundColor || '#111827' }}>
        {settings.backgroundImageUrl && <Image src={settings.backgroundImageUrl} alt={settings.title || 'Banner'} layout="fill" objectFit="cover" className="opacity-30" data-ai-hint="store banner"/>}
        <div className="relative z-10 space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#FFFFFF'}}>{settings.title || 'Welcome to Our Shop'}</h1>
            <p className="text-lg md:text-xl text-white/80" style={{fontFamily: settings.fontFamily}}>{settings.subtitle || 'Discover our amazing products'}</p>
            {settings.buttonText && <Button size="lg" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>{settings.buttonText}</Button>}
        </div>
    </div>
);
