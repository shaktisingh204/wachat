
'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Image from 'next/image';
import React from 'react';

export function TestimonialsBlockRenderer({ settings }: { settings: any }) {
    const layout = settings.layout || {};
    const style: React.CSSProperties = {
        width: layout.width || '100%',
        height: layout.height || 'auto',
        maxWidth: layout.maxWidth || undefined,
        minHeight: layout.minHeight || undefined,
        overflow: layout.overflow || 'visible',
    };

    return (
     <div className="max-w-5xl mx-auto" style={style}>
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'What Our Customers Say'}</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.testimonials || []).map((item: any) => (
                <Card key={item.id} className="flex flex-col">
                    <CardContent className="p-6 flex-grow">
                        <p className="italic text-muted-foreground">"{item.quote}"</p>
                    </CardContent>
                    <CardFooter className="flex items-center gap-4 mt-auto">
                        <Avatar>
                            {item.avatar ? (
                                <AvatarImage src={item.avatar} alt={item.author} data-ai-hint="person avatar" />
                            ) : null}
                            <AvatarFallback>{item.author?.charAt(0) || 'A'}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{item.author}</p>
                            <p className="text-sm text-muted-foreground">{item.title}</p>
                        </div>
                    </CardFooter>
                </Card>
            ))}
        </div>
    </div>
    )
}
