
'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

type Tab = {
  id: string;
  label: string;
  icon?: string;
  content: string;
};

interface TabsBlockRendererProps {
  settings: {
    tabs?: Tab[];
    defaultActiveTab?: string;
    htmlTag?: string;
    alignment?: 'start' | 'center' | 'end';
    stretchTabs?: boolean;
    tabSpacing?: number;
    
    // Style props
    tabsListBgColor?: string;
    tabsListBorderRadius?: number;
    tabsListShadow?: string;
    tabTextColor?: string;
    activeTabTextColor?: string;
    activeTabBgColor?: string;
    contentBgColor?: string;
    contentTextColor?: string;
    contentPadding?: number;
    contentBorderRadius?: number;
    contentBorderType?: string;
    contentShadow?: string;
    
    // Advanced props
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    animation?: 'none' | 'fadeIn' | 'fadeInUp';
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

export const TabsBlockRenderer: React.FC<TabsBlockRendererProps> = ({ settings }) => {
  const tabs = settings.tabs || [];
  const alignment = settings.alignment || 'start';

  if (tabs.length === 0) {
    return (
      <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">
        Tabs Block: No tabs configured.
      </div>
    );
  }

  const wrapperStyle: React.CSSProperties = {
    paddingTop: settings.padding?.top ? `${settings.padding.top}px` : undefined,
    paddingRight: settings.padding?.right ? `${settings.padding.right}px` : undefined,
    paddingBottom: settings.padding?.bottom ? `${settings.padding.bottom}px` : undefined,
    paddingLeft: settings.padding?.left ? `${settings.padding.left}px` : undefined,
    marginTop: settings.margin?.top ? `${settings.margin.top}px` : undefined,
    marginRight: settings.margin?.right ? `${settings.margin.right}px` : undefined,
    marginBottom: settings.margin?.bottom ? `${settings.margin.bottom}px` : undefined,
    marginLeft: settings.margin?.left ? `${settings.margin.left}px` : undefined,
  };

  const tabsListStyle: React.CSSProperties = {
    backgroundColor: settings.tabsListBgColor || 'hsl(var(--muted))',
    borderRadius: settings.tabsListBorderRadius ? `${settings.tabsListBorderRadius}px` : undefined,
    justifyContent: alignment,
    gap: settings.tabSpacing ? `${settings.tabSpacing}px` : undefined,
  };
  
  const contentStyle: React.CSSProperties = {
    backgroundColor: settings.contentBgColor,
    color: settings.contentTextColor,
    padding: settings.contentPadding ? `${settings.contentPadding}px` : undefined,
    borderRadius: settings.contentBorderRadius ? `${settings.contentBorderRadius}px` : undefined,
    border: settings.contentBorderType !== 'none' ? `1px ${settings.contentBorderType || 'solid'} hsl(var(--border))` : 'none',
  };
  
  const shadowClasses: Record<string, string> = { sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' };

  const animationClass = {
    fadeIn: 'animate-in fade-in duration-500',
    fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
  }[settings.animation || 'none'];

  const responsiveClasses = cn({
    'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
    'hidden md:max-lg:flex': settings.responsiveVisibility?.tablet === false,
    'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
  });
  
  const customAttributes = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
    if(attr.key) acc[attr.key] = attr.value;
    return acc;
  }, {});

  return (
    <div id={settings.cssId} style={wrapperStyle} className={cn(animationClass, responsiveClasses, settings.cssClasses)} {...customAttributes}>
      {settings.customCss && <style>{settings.customCss}</style>}
      <style>{`
          [data-radix-collection-item][data-state="active"] {
            background-color: ${settings.activeTabBgColor || 'hsl(var(--background))'} !important;
            color: ${settings.activeTabTextColor || 'hsl(var(--foreground))'} !important;
            box-shadow: ${settings.contentShadow && settings.contentShadow !== 'none' ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' : 'none'};
          }
        `}</style>
      <Tabs defaultValue={settings.defaultActiveTab || tabs[0]?.id}>
        <TabsList
          className={cn(
            "w-full h-auto p-1",
            settings.stretchTabs && 'grid',
            shadowClasses[settings.tabsListShadow || 'none']
          )}
          style={{
            ...tabsListStyle,
            ...(settings.stretchTabs && { gridTemplateColumns: `repeat(${tabs.length}, 1fr)`})
          }}
        >
          {tabs.map(tab => {
            // @ts-ignore
            const Icon = tab.icon ? LucideIcons[tab.icon] : null;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                style={{ color: settings.tabTextColor }}
                className="flex-row-reverse"
              >
                {tab.label}
                {Icon && <Icon className="mr-2 h-4 w-4" />}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {tabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className={cn("mt-4 p-4 border rounded-lg", shadowClasses[settings.contentShadow || 'none'])} style={contentStyle}>
            <p>{tab.content}</p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
