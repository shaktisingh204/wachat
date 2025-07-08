
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
    layout?: 'horizontal' | 'vertical';
    alignment?: 'start' | 'center' | 'end';
    animation?: 'fade' | 'slide';
    
    // Style props
    tabsListBgColor?: string;
    tabsListBorderRadius?: number;
    tabTextColor?: string;
    activeTabTextColor?: string;
    activeTabBgColor?: string;
    contentBgColor?: string;
    contentTextColor?: string;
    contentPadding?: number;
    contentBorderRadius?: number;
    
    // Advanced props
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
  };
}

export const TabsBlockRenderer: React.FC<TabsBlockRendererProps> = ({ settings }) => {
  const tabs = settings.tabs || [];
  const layout = settings.layout || 'horizontal';
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
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: settings.contentBgColor,
    color: settings.contentTextColor,
    padding: settings.contentPadding ? `${settings.contentPadding}px` : undefined,
    borderRadius: settings.contentBorderRadius ? `${settings.contentBorderRadius}px` : undefined,
  };
  
  const animationClass = settings.animation === 'slide' 
    ? "data-[state=active]:animate-in data-[state=active]:slide-in-from-left-4" 
    : "data-[state=active]:animate-in data-[state=active]:fade-in-25";

  return (
    <div style={wrapperStyle}>
      <Tabs defaultValue={tabs[0].id} className={cn(layout === 'vertical' && 'flex gap-4')}>
        <style>{`
          [data-radix-collection-item][data-state="active"] {
            background-color: ${settings.activeTabBgColor || 'hsl(var(--background))'} !important;
            color: ${settings.activeTabTextColor || 'hsl(var(--foreground))'} !important;
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
          }
        `}</style>
        <TabsList 
            className={cn(
                "w-full h-auto p-1",
                layout === 'horizontal' && 'grid',
                layout === 'vertical' && 'flex flex-col w-48'
            )}
            style={{
                 ...tabsListStyle,
                 ...(layout === 'horizontal' && { gridTemplateColumns: `repeat(${tabs.length}, 1fr)`})
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
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {tabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className={cn("mt-4 p-4 border rounded-lg", animationClass)} style={contentStyle}>
            <p>{tab.content}</p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
