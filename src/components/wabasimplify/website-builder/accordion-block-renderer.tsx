
'use client';

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

type AccordionItemData = {
  id: string;
  title: string;
  content: string;
};

interface AccordionBlockRendererProps {
  settings: {
    items?: AccordionItemData[];
    behavior?: 'single' | 'multiple';
    spaceBetween?: number;
    border?: { type?: string; width?: string; color?: string; radius?: string };
    boxShadow?: 'none' | 'sm' | 'md' | 'lg';
    titleBgColor?: string;
    titleColor?: string;
    activeTitleBgColor?: string;
    activeTitleColor?: string;
    titlePadding?: number;
    contentBgColor?: string;
    contentColor?: string;
    contentPadding?: number;
    margin?: { top?: number; bottom?: number };
    padding?: { top?: number; bottom?: number };
  };
}

export const AccordionBlockRenderer: React.FC<AccordionBlockRendererProps> = ({ settings }) => {
    const { 
        items = [],
        behavior = 'single',
        spaceBetween = 10,
        border = { type: 'solid', width: '1', color: '#e5e7eb', radius: '8' },
        boxShadow = 'sm',
        titleBgColor = '#FFFFFF',
        titleColor = '#000000',
        activeTitleBgColor = '#F9FAFB',
        activeTitleColor = '#000000',
        titlePadding = 16,
        contentBgColor = '#FFFFFF',
        contentColor = '#333333',
        contentPadding = 16,
        margin = {},
        padding = {}
    } = settings;

    if (items.length === 0) {
        return (
            <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                Accordion Block: No items configured.
            </div>
        );
    }
    
    const wrapperStyle: React.CSSProperties = {
        paddingTop: padding.top ? `${padding.top}px` : undefined,
        paddingBottom: padding.bottom ? `${padding.bottom}px` : undefined,
        marginTop: margin.top ? `${margin.top}px` : undefined,
        marginBottom: margin.bottom ? `${margin.bottom}px` : undefined,
    };
    
    const itemStyle: React.CSSProperties = {
        marginBottom: `${spaceBetween}px`,
        borderStyle: border.type !== 'none' ? border.type : undefined,
        borderWidth: border.type !== 'none' ? `${border.width || 1}px` : undefined,
        borderColor: border.type !== 'none' ? border.color : undefined,
        borderRadius: border.radius ? `${border.radius}px` : undefined,
    };

    const shadowClass = {
        sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg'
    }[boxShadow] || '';

    const contentStyle: React.CSSProperties = {
        backgroundColor: contentBgColor,
        color: contentColor,
        padding: `${contentPadding}px`
    };

    const triggerStyle: React.CSSProperties = {
        backgroundColor: titleBgColor,
        color: titleColor,
        padding: `${titlePadding}px`,
        borderRadius: 'inherit'
    };
    
    // Using a style tag to handle data attributes for active state
    const dynamicStyles = `
        .accordion-item-${settings.id} > [data-state="open"] > button {
            background-color: ${activeTitleBgColor} !important;
            color: ${activeTitleColor} !important;
        }
    `;

    return (
        <div style={wrapperStyle}>
            <style>{dynamicStyles}</style>
            <Accordion type={behavior} collapsible className="w-full">
                {items.map(item => (
                    <AccordionItem 
                        key={item.id} 
                        value={item.id} 
                        style={itemStyle} 
                        className={cn(`accordion-item-${settings.id} border-none overflow-hidden`, shadowClass)}
                    >
                        <AccordionTrigger style={triggerStyle}>
                            {item.title}
                        </AccordionTrigger>
                        <AccordionContent>
                           <div style={contentStyle}>
                            {item.content}
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};
