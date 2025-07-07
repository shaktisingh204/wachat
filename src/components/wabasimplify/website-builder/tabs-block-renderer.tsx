
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
    animation?: 'fade' | 'slide';
    activeTabBgColor?: string;
    activeTabTextColor?: string;
  };
}

export const TabsBlockRenderer: React.FC<TabsBlockRendererProps> = ({ settings }) => {
  const tabs = settings.tabs || [];
  const layout = settings.layout || 'horizontal';

  if (tabs.length === 0) {
    return (
      <div className="p-4 text-center border-2 border-dashed rounded-lg text-muted-foreground">
        Tabs Block: No tabs configured.
      </div>
    );
  }

  const activeTabStyle: React.CSSProperties = {
    backgroundColor: settings.activeTabBgColor,
    color: settings.activeTabTextColor,
  };

  const animationClass = settings.animation === 'slide' 
    ? "data-[state=active]:animate-in data-[state=active]:slide-in-from-left-4" 
    : "data-[state=active]:animate-in data-[state=active]:fade-in-25";

  return (
    <Tabs defaultValue={tabs[0].id} className={cn("w-full", layout === 'vertical' && 'flex gap-4')}>
      <TabsList className={cn(
        "w-full",
        layout === 'horizontal' && 'grid',
        layout === 'vertical' && 'flex flex-col w-48 h-fit'
      )} style={layout === 'horizontal' ? { gridTemplateColumns: `repeat(${tabs.length}, 1fr)`} : {}}>
        {tabs.map(tab => {
          // @ts-ignore
          const Icon = tab.icon ? LucideIcons[tab.icon] : null;
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:shadow-md" style={settings.activeTabBgColor ? activeTabStyle : {}}>
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {tabs.map(tab => (
        <TabsContent key={tab.id} value={tab.id} className={cn("mt-4 p-4 border rounded-lg bg-background", animationClass)}>
          <p>{tab.content}</p>
        </TabsContent>
      ))}
    </Tabs>
  );
};
