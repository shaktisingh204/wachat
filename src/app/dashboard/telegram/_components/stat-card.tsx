import * as React from 'react';
import { Card, Skeleton } from '@/components/zoruui';

interface StatCardProps {
    label: string;
    value: string | number | null;
    hint?: string;
    isLoading?: boolean;
}

export function StatCard({ label, value, hint, isLoading }: StatCardProps) {
    return (
        <Card className="p-6 flex flex-col justify-between">
            <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
                    {label}
                </p>
                <div className="mt-2 flex items-center min-h-[30px]">
                    {isLoading ? (
                        <Skeleton className="h-7 w-16" />
                    ) : (
                        <p className="text-[26px] leading-none text-zoru-ink">{value}</p>
                    )}
                </div>
            </div>
            {hint && (
                <div className="mt-2 min-h-[18px]">
                    {isLoading ? (
                        <Skeleton className="h-3 w-24" />
                    ) : (
                        <p className="text-[12px] text-zoru-ink-muted">{hint}</p>
                    )}
                </div>
            )}
        </Card>
    );
}
