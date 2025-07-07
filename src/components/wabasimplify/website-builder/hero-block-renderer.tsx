
'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';

export const HeroBlock = ({ settings }: { settings: any }) => {
    if (settings.layout === 'offset-box') {
        return (
            <div className="relative h-[500px] md:h-[600px] w-full" style={{ backgroundColor: settings.backgroundColor || '#F3F4F6' }}>
                {settings.backgroundImageUrl && <Image src={settings.backgroundImageUrl} alt={settings.title || 'Banner'} layout="fill" objectFit="cover" className="opacity-90" data-ai-hint="fashion model"/>}
                <div className="relative z-10 h-full flex items-center max-w-7xl mx-auto px-4">
                    <div className="max-w-md bg-background/80 backdrop-blur-sm p-8 rounded-lg animate-fade-in-up">
                        <h1 className="text-4xl md:text-5xl font-extrabold" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#11182c'}}>{settings.title || 'Feel The Best, Look The Best'}</h1>
                        <p className="mt-4 text-lg md:text-xl" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#11182c'}}>{settings.subtitle || 'Complete your style with awesome clothes from us.'}</p>
                        {settings.buttonText && <Button size="lg" className="mt-6" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>{settings.buttonText}</Button>}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative h-96 md:h-[500px] text-white flex flex-col items-center justify-center text-center" style={{ backgroundColor: settings.backgroundColor || '#FFFFFF' }}>
            {settings.backgroundImageUrl && <Image src={settings.backgroundImageUrl} alt={settings.title || 'Banner'} layout="fill" objectFit="cover" className="opacity-90" data-ai-hint="store banner"/>}
            <div className="relative z-10 space-y-4 max-w-7xl mx-auto px-4 w-full">
                <div className="max-w-2xl mx-auto space-y-4">
                    <h1 className="text-4xl md:text-6xl font-extrabold" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#000000'}}>{settings.title || 'Designed to go places.'}</h1>
                    <p className="text-lg md:text-xl" style={{fontFamily: settings.fontFamily, color: settings.textColor || '#000000'}}>{settings.subtitle || 'Our new collection is here'}</p>
                    {settings.buttonText && <Button size="lg" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>{settings.buttonText}</Button>}
                </div>
            </div>
        </div>
    );
};
