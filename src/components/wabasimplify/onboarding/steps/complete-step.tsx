'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AVAILABLE_MODULES } from './requirements-step';

interface CompleteStepProps {
    userName?: string;
    selectedModules: string[];
}

export function CompleteStep({
    userName,
    selectedModules,
}: CompleteStepProps) {
    const router = useRouter();

    React.useEffect(() => {
        // Prefetch the dashboard so the final click is instant.
        router.prefetch('/dashboard');
    }, [router]);

    const activated = AVAILABLE_MODULES.filter((m) =>
        selectedModules.includes(m.id)
    );

    return (
        <div className="space-y-6 text-center sm:text-left">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">
                        Welcome aboard{userName ? `, ${userName}` : ''}!
                    </h2>
                    <p className="text-muted-foreground">
                        Your workspace is ready. Here's what's tailored for
                        you.
                    </p>
                </div>
            </div>

            {activated.length > 0 && (
                <div className="rounded-xl border bg-muted/40 p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Your stack
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {activated.map((m) => {
                            const Icon = m.icon;
                            return (
                                <div
                                    key={m.id}
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm'
                                    )}
                                >
                                    <Icon className="h-4 w-4 text-primary" />
                                    <span className="font-medium">
                                        {m.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <p className="text-sm font-semibold">Next up</p>
                <div className="grid gap-2">
                    <NextLink
                        href="/dashboard"
                        title="Open your dashboard"
                        description="Your personalized home with the modules you picked."
                    />
                    <NextLink
                        href="/setup"
                        title="Connect your WhatsApp Business Account"
                        description="Use the Meta guided popup to attach your WABA in minutes."
                    />
                    <NextLink
                        href="/dashboard/user/billing"
                        title="Review billing & invoices"
                        description="Manage your plan, payment methods, and credits."
                    />
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button asChild className="h-11 px-6 text-base">
                    <Link href="/dashboard">
                        Go to dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}

function NextLink({
    href,
    title,
    description,
}: {
    href: string;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-start justify-between rounded-xl border bg-card p-4 transition hover:border-primary/60 hover:shadow-sm"
        >
            <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
    );
}
