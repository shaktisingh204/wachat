

'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, MessageSquare, Send, Users, BarChart, Settings, Database, ChevronRight, FileText, History, Zap } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mainNavItems = [
    { href: "/dashboard/sms", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/sms/contacts", label: "Contacts", icon: Users },
    { href: "/dashboard/sms/analytics", label: "Analytics", icon: BarChart },
    { href: "/dashboard/sms/settings", label: "Settings", icon: Settings },
    { href: "/dashboard/sms/integrations", label: "Integrations", icon: Zap },
];

const messagingNavItems = [
     { href: "/dashboard/sms/campaigns", label: "Send SMS", icon: Send },
     { href: "/dashboard/sms/message-history", label: "Message History", icon: History },
     { href: "/dashboard/sms/delivery-reports", label: "Delivery Reports", icon: FileText },
];

const dltNavItems = [
    { href: "/dashboard/sms/dlt", label: "Connect DLT Account" },
    { href: "/dashboard/sms/entity-management", label: "Entity Management" },
    { href: "/dashboard/sms/header-management", label: "Header Management" },
    { href: "/dashboard/sms/template-management", label: "Template Management" },
];


export default function SmsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isDltSectionActive = dltNavItems.some(item => pathname.startsWith(item.href));
    const isMessagingSectionActive = messagingNavItems.some(item => pathname.startsWith(item.href));

    return (
        <div className="flex flex-col gap-6">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <MessageSquare className="h-8 w-8" />
                    SMS Suite
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage your SMS campaigns and provider integrations.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
                <nav className="flex flex-col gap-1">
                    {mainNavItems.map(item => (
                        <Button 
                            key={item.href}
                            asChild 
                            variant={pathname === item.href ? 'secondary' : 'ghost'} 
                            className="justify-start"
                        >
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4"/>
                                {item.label}
                            </Link>
                        </Button>
                    ))}
                     <Collapsible defaultOpen={isMessagingSectionActive}>
                        <CollapsibleTrigger asChild>
                             <Button variant="ghost" className="w-full justify-between group">
                                <span className="flex items-center gap-2">
                                     <MessageSquare className="h-4 w-4"/>
                                    Messaging
                                </span>
                                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90"/>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 pt-1 space-y-1">
                             {messagingNavItems.map(item => (
                                <Button 
                                    key={item.href}
                                    asChild 
                                    variant={pathname.startsWith(item.href) ? 'secondary' : 'ghost'} 
                                    className="w-full justify-start h-9"
                                >
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                     <Collapsible defaultOpen={isDltSectionActive}>
                        <CollapsibleTrigger asChild>
                             <Button variant="ghost" className="w-full justify-between group">
                                <span className="flex items-center gap-2">
                                     <Database className="h-4 w-4"/>
                                    DLT Management
                                </span>
                                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90"/>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 pt-1 space-y-1">
                             {dltNavItems.map(item => (
                                <Button 
                                    key={item.href}
                                    asChild 
                                    variant={pathname.startsWith(item.href) ? 'secondary' : 'ghost'} 
                                    className="w-full justify-start h-9"
                                >
                                    <Link href={item.href}>
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                </nav>
                <div className="mt-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
