
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Settings } from "lucide-react";

const navItems = [
    { href: "/dashboard/calls/logs", label: "Call Logs", icon: Phone },
    { href: "/dashboard/calls/settings", label: "Settings", icon: Settings },
];

export default function CallsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
            <Tabs defaultValue={pathname} className="w-full">
                <TabsList>
                    {navItems.map(item => (
                         <TabsTrigger key={item.href} value={item.href} asChild>
                            <Link href={item.href}>
                                <item.icon className="mr-2 h-4 w-4"/>
                                {item.label}
                            </Link>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div className="mt-4">
                 {children}
            </div>
        </div>
    );
}
