
'use client';

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type AccordionItemData = {
  id: string;
  title: string;
  content: string;
};

interface AccordionBlockRendererProps {
  settings: {
    items?: AccordionItemData[];
    behavior?: 'single' | 'multiple';
    backgroundColor?: string;
    border?: {
        width?: string;
        color?: string;
        style?: string;
    }
  };
}

export const AccordionBlockRenderer: React.FC<AccordionBlockRendererProps> = ({ settings }) => {
    const items = settings.items || [];

    if (items.length === 0) {
        return (
            <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                Accordion Block: No items configured.
            </div>
        );
    }
    
    const itemStyle: React.CSSProperties = {
        backgroundColor: settings.backgroundColor,
        borderWidth: settings.border?.width ? `${settings.border.width}px` : undefined,
        borderColor: settings.border?.color,
        borderStyle: settings.border?.style as any,
    };
    
    return (
        <Accordion type={settings.behavior || 'single'} collapsible>
            {items.map(item => (
                <AccordionItem key={item.id} value={item.id} style={itemStyle} className="mb-2 last:mb-0 rounded-lg overflow-hidden px-4">
                    <AccordionTrigger>{item.title}</AccordionTrigger>
                    <AccordionContent>
                        {item.content}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
};
