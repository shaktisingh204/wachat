'use client';

import {
  ZoruButton,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipTrigger,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerTrigger,
  ZoruScrollArea,
  type ZoruButtonProps,
} from '@/components/zoruui';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

import * as React from 'react';
import Link from 'next/link';

import { PanelLeft, Calendar } from 'lucide-react';

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

export function SidebarProvider({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
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
    <div className="flex h-full  flex-col">{children}</div>
  );

  if (isMobile) {
    return (
      <ZoruDrawer open={isOpen} onOpenChange={setIsOpen} direction="left">
        <ZoruDrawerContent className="h-full max-w-xs p-0 bg-sidebar-secondary-background">
          {sidebarContent}
        </ZoruDrawerContent>
      </ZoruDrawer>
    );
  }

  return (
    <aside className={cn('flex h-full flex-col bg-white/70 backdrop-blur-xl rounded-lg shadow-sm border-0 transition-[width] duration-300 ease-in-out group overflow-hidden z-30 relative', isOpen ? 'w-fit min-w-60' : 'w-[70px] hover:w-fit hover:min-w-60 hover:shadow-xl', className)}>
      {sidebarContent}
    </aside>
  );
}

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex h-16 shrink-0 items-center justify-center p-3', className)} {...props} />
));
SidebarHeader.displayName = 'SidebarHeader';

export function SidebarContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = useSidebar();
  return (
    <ZoruScrollArea className="flex-1" viewportClassName={cn(!isOpen && 'p-2')}>
      {children}
    </ZoruScrollArea>
  );
}

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(({ className, ...props }, ref) => {
  const { isOpen } = useSidebar();
  return (
    <ul ref={ref} className={cn('flex flex-col gap-1', isOpen ? 'p-2' : 'items-center', className)} {...props} />
  );
});
SidebarMenu.displayName = 'SidebarMenu';

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('w-full', className)} {...props} />
));
SidebarMenuItem.displayName = 'SidebarMenuItem';

type SidebarMenuZoruButtonProps = ZoruButtonProps & {
  isActive?: boolean;
  tooltip?: string;
  asChild?: boolean;
  showTooltip?: boolean;
};

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuZoruButtonProps>(
  ({ isActive, tooltip, asChild, showTooltip, ...props }, ref) => {
    const { isOpen } = useSidebar();

    const buttonContent = (
      <ZoruButton
        ref={ref}
        variant={isActive ? 'sidebar-active' : 'ghost'}
        className={cn('w-full transition-all duration-300', isOpen ? 'justify-start px-4' : 'h-12 w-full justify-center px-2 group-hover:justify-start group-hover:px-4')}
        asChild={asChild}
        {...props}
      />
    );

    if (isOpen && !showTooltip) return buttonContent;

    return (
      <ZoruTooltip>
        <ZoruTooltipTrigger asChild>{buttonContent}</ZoruTooltipTrigger>
        <ZoruTooltipContent side="right" sideOffset={10}>
          <p>{tooltip}</p>
        </ZoruTooltipContent>
      </ZoruTooltip>
    );
  }
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div ref={ref} className="mt-auto p-2" {...props} />
));
SidebarFooter.displayName = 'SidebarFooter';

export const SidebarTrigger = ({ children }: { children?: React.ReactNode }) => {
  const { isMobile, isOpen, setIsOpen } = useSidebar();
  if (isMobile) {
    return (
      <ZoruDrawerTrigger asChild>
        {children}
      </ZoruDrawerTrigger>
    )
  }

  if (!children) {
    return (
      <ZoruButton variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
        <PanelLeft />
      </ZoruButton>
    );
  }

  return React.cloneElement(children as React.ReactElement, {
    onClick: () => setIsOpen(!isOpen),
  } as any);
}
