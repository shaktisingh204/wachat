import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/zoruui';
import { ArrowUpRight } from 'lucide-react';

export interface QuickTileProps {
    href: string;
    label: string;
    description: string;
    icon: React.ElementType;
}

export function QuickTile({ href, label, description, icon: Icon }: QuickTileProps) {
    return (
        <Link href={href} className="group block h-full">
            <Card className="h-full p-6 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #E0F4FF 0%, #B9E4FA 100%)' }}
                    >
                        <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: '#007DBB' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] text-zoru-ink">{label}</p>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zoru-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                            {description}
                        </p>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
