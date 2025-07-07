
'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import React from 'react';

export function FaqBlockRenderer({ settings }: { settings: any }) {
    const layout = settings.layout || {};

    const style: React.CSSProperties = {
        width: layout.width || '100%',
        height: layout.height || 'auto',
        maxWidth: layout.maxWidth || undefined,
        minHeight: layout.minHeight || undefined,
        overflow: layout.overflow || 'visible',
    };

    return (
     <div className="max-w-3xl mx-auto" style={style}>
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{settings.title || 'Frequently Asked Questions'}</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
            {(settings.faqItems || []).map((item: any, index: number) => (
                <AccordionItem value={`item-${item.id || index}`} key={item.id || index}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    </div>
);
}
