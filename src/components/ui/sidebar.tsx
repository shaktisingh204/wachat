
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { ScrollArea } from './scroll-area';
import { PanelLeft , Calendar } from 'lucide-react';

type SidebarContextProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isMobile: boolean;
};

const SidebarContext = React.createContext<SidebarContextProps | undefined>(undefined);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(!isMobile);

  React.useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({ className, children }: { className?: string; children: React.ReactNode }) {
  const { isMobile, isOpen, setIsOpen } = useSidebar();

  const sidebarContent = (
    <div className="flex h-full flex-col">{children}</div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen} direction="left">
        <DrawerContent className="h-full max-w-xs p-0 bg-sidebar-secondary-background">
            {sidebarContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside className={cn('flex h-full flex-col bg-card rounded-lg shadow-sm transition-[width]', isOpen ? 'w-60' : 'w-0 hidden', className)}>
      {sidebarContent}
    </aside>
  );
}

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex h-16 shrink-0 items-center justify-center border-b p-3', className)} {...props} />
));
SidebarHeader.displayName = 'SidebarHeader';

export function SidebarContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = useSidebar();
  return (
    <ScrollArea className="flex-1" viewportClassName={cn(!isOpen && 'p-2')}>
        {children}
    </ScrollArea>
  );
}

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(({ className, ...props }, ref) => {
  const { isOpen } = useSidebar();
  return (
    <ul ref={ref} className={cn('flex flex-col gap-1', isOpen ? 'p-2' : 'items-center', className)} {...props} />
  );
});
SidebarMenu.displayName = 'SidebarMenu';

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>((props, ref) => (
  <li ref={ref} {...props} />
));
SidebarMenuItem.displayName = 'SidebarMenuItem';

type SidebarMenuButtonProps = ButtonProps & {
  isActive?: boolean;
  tooltip?: string;
  asChild?: boolean;
};

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ isActive, tooltip, asChild, ...props }, ref) => {
    const { isOpen } = useSidebar();

    const buttonContent = (
      <Button
        ref={ref}
        variant={isActive ? 'sidebar-active' : 'ghost'}
        className={cn('w-full', isOpen ? 'justify-start' : 'h-10 justify-center')}
        asChild={asChild}
        {...props}
      />
    );

    if (isOpen) return buttonContent;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div ref={ref} className="mt-auto p-2" {...props} />
));
SidebarFooter.displayName = 'SidebarFooter';

export const SidebarTrigger = ({ children }: { children: React.ReactNode }) => {
    const { isMobile, isOpen, setIsOpen } = useSidebar();
    if (isMobile) {
        return (
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
        )
    }

    if (!children) return null;

    return React.cloneElement(children as React.ReactElement, {
        onClick: () => setIsOpen(!isOpen),
    });
}
