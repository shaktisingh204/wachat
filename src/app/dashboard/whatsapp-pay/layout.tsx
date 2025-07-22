
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndianRupee, Settings, History } from "lucide-react";
import { WaPayIcon } from "@/components/wabasimplify/custom-sidebar-components";

const navItems = [
    { href: "/dashboard/whatsapp-pay", label: "Transactions", icon: History },
    { href: "/dashboard/whatsapp-pay/settings", label: "Setup", icon: Settings },
];

export default function WhatsAppPayLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-6">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <WaPayIcon className="h-8 w-8"/>
                    WhatsApp Pay
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage your WhatsApp Pay configurations and view transaction history.
                </p>
            </div>
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
