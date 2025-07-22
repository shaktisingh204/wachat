
'use client';

import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isRootIntegrationsPage = pathname === '/dashboard/integrations';

    return (
        <div className="flex flex-col gap-8">
            <div>
                 {!isRootIntegrationsPage && (
                    <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/integrations">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to All Integrations
                        </Link>
                    </Button>
                )}
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Zap className="h-8 w-8" />
                    Integrations &amp; Tools
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect SabNode with your favorite tools and services.
                </p>
            </div>
            <div>
                {children}
            </div>
        </div>
    );
}
