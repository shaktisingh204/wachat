
'use client';

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

type AccordionItemData = {
  id: string;
  title: string;
  content: string;
  icon?: string;
};

interface AccordionBlockRendererProps {
  settings: {
    items?: AccordionItemData[];
    behavior?: 'single' | 'multiple';
    defaultActiveItem?: string;
    titleHtmlTag?: 'h2' | 'h3' | 'h4' | 'div';
    inactiveIcon?: string;
    activeIcon?: string;
    iconPosition?: 'left' | 'right';
    spaceBetween?: number;
    border?: { type?: string; width?: {top?: string, right?: string, bottom?: string, left?: string}, color?: string; radius?: string };
    boxShadow?: 'none' | 'sm' | 'md' | 'lg';
    titleBgColor?: string;
    titleColor?: string;
    titleFontFamily?: string;
    activeTitleBgColor?: string;
    activeTitleColor?: string;
    titlePadding?: number;
    contentBgColor?: string;
    contentColor?: string;
    contentFontFamily?: string;
    contentPadding?: number;
    margin?: { top?: number; bottom?: number };
    padding?: { top?: number; bottom?: number };
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    animation?: 'none' | 'fadeIn' | 'fadeInUp';
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

const IconRenderer = ({ iconName, className }: { iconName?: string; className?: string }) => {
    // @ts-ignore
    const IconComponent = iconName ? LucideIcons[iconName] : null;
    if (!IconComponent) return null;
    return <IconComponent className={cn('h-4 w-4 shrink-0 transition-transform duration-200', className)} />;
};

export const AccordionBlockRenderer: React.FC<AccordionBlockRendererProps> = ({ settings }) => {
    const { 
        items = [],
        behavior = 'single',
        defaultActiveItem,
        titleHtmlTag: TitleTag = 'h3',
        inactiveIcon = 'Plus',
        activeIcon = 'Minus',
        iconPosition = 'right',
        spaceBetween = 10,
        border = { type: 'solid', width: {top: '0', right: '0', bottom: '1', left: '0'}, color: '#e5e7eb', radius: '0' },
        boxShadow = 'none',
        titleBgColor, titleColor, titleFontFamily,
        activeTitleBgColor, activeTitleColor, titlePadding,
        contentBgColor, contentColor, contentFontFamily, contentPadding,
        margin, padding, responsiveVisibility, animation, cssId, cssClasses, customCss, customAttributes
    } = settings;

    if (items.length === 0) {
        return <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">Accordion Block: No items configured.</div>;
    }
    
    const wrapperStyle: React.CSSProperties = {
        paddingTop: padding?.top ? `${padding.top}px` : undefined,
        paddingBottom: padding?.bottom ? `${padding.bottom}px` : undefined,
        marginTop: margin?.top ? `${margin.top}px` : undefined,
        marginBottom: margin?.bottom ? `${margin.bottom}px` : undefined,
    };

    const itemStyle: React.CSSProperties = {
        borderStyle: border.type !== 'none' ? border.type : undefined,
        borderTopWidth: border.type !== 'none' ? `${border.width?.top || 0}px` : undefined,
        borderRightWidth: border.type !== 'none' ? `${border.width?.right || 0}px` : undefined,
        borderBottomWidth: border.type !== 'none' ? `${border.width?.bottom || 1}px` : undefined,
        borderLeftWidth: border.type !== 'none' ? `${border.width?.left || 0}px` : undefined,
        borderColor: border.type !== 'none' ? border.color : undefined,
        borderRadius: border.radius ? `${border.radius}px` : undefined,
    };

    const shadowClass = { sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg'}[boxShadow] || '';
    
    const contentStyle: React.CSSProperties = {
        backgroundColor: contentBgColor,
        color: contentColor,
        fontFamily: contentFontFamily,
        padding: contentPadding ? `${contentPadding}px` : undefined,
    };

    const triggerStyle: React.CSSProperties = {
        backgroundColor: titleBgColor,
        color: titleColor,
        fontFamily: titleFontFamily,
        padding: titlePadding ? `${titlePadding}px` : undefined,
    };
    
    const animationClass = { fadeIn: 'animate-in fade-in duration-500', fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500' }[animation || 'none'];
    const responsiveClasses = cn({ 'max-lg:hidden': responsiveVisibility?.desktop === false, 'max-md:hidden lg:hidden': responsiveVisibility?.tablet === false, 'max-sm:hidden': responsiveVisibility?.mobile === false });
    const customAttrs = (customAttributes || []).reduce((acc: any, attr: any) => { if(attr.key) acc[attr.key] = attr.value; return acc; }, {});

    const dynamicStyles = `
        .accordion-item-${settings.id} > [data-state="open"] > button { background-color: ${activeTitleBgColor || ''} !important; color: ${activeTitleColor || ''} !important; }
        .accordion-item-${settings.id} > [data-state="open"] .inactive-icon { display: none; }
        .accordion-item-${settings.id} > [data-state="closed"] .active-icon { display: none; }
        ${customCss || ''}
    `;

    return (
        <div id={cssId} className={cn(animationClass, responsiveClasses, cssClasses)} style={wrapperStyle} {...customAttrs}>
            <style>{dynamicStyles}</style>
            <Accordion type={behavior} collapsible className="w-full space-y-2" defaultValue={defaultActiveItem} style={{ gap: `${spaceBetween}px` }}>
                {items.map(item => (
                    <AccordionItem 
                        key={item.id} 
                        value={item.id} 
                        style={itemStyle} 
                        className={cn(`accordion-item-${settings.id} border-none overflow-hidden`, shadowClass)}
                    >
                        <AccordionTrigger style={triggerStyle} asChild>
                             <TitleTag className={cn('flex flex-1 items-center justify-between font-medium transition-all hover:underline', iconPosition === 'right' && 'flex-row-reverse')}>
                                {item.icon && <IconRenderer iconName={item.icon} className="mr-2" />}
                                {item.title}
                                <div className="relative">
                                    <IconRenderer iconName={inactiveIcon} className="inactive-icon" />
                                    <IconRenderer iconName={activeIcon} className="active-icon" />
                                </div>
                            </TitleTag>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div style={contentStyle} className="whitespace-pre-wrap">{item.content}</div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};

    