
'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function FaqBlockRenderer({ settings }: { settings: any }) {
    return (
     <div className="max-w-3xl mx-auto">
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
