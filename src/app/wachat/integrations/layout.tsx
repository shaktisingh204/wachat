'use client';

import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WachatPage } from "@/app/wachat/_components/wachat-page";

function cx(...a: Array<string | false | null | undefined>) {
    return a.filter(Boolean).join(' ');
}

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isRootIntegrationsPage = pathname === '/wachat/integrations';

    return (
        <WachatPage
            breadcrumb={[
                { label: 'SabNode', href: '/dashboard' },
                { label: 'WaChat', href: '/wachat' },
                { label: 'Integrations' },
            ]}
            title={
                <span className="flex items-center gap-3">
                    <Zap className="h-7 w-7" aria-hidden="true" />
                    Integrations &amp; Tools
                </span>
            }
            description="Connect SabNode with your favorite tools and services."
        >
            <div className="flex flex-col gap-8">
                {!isRootIntegrationsPage && (
                    <div>
                        <Link
                            href="/wachat/integrations"
                            className={cx('u-btn', 'u-btn--ghost', 'u-btn--md', '-ml-2')}
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            <span className="u-btn__label">Back to All Integrations</span>
                        </Link>
                    </div>
                )}
                <div>{children}</div>
            </div>
        </WachatPage>
    );
}
