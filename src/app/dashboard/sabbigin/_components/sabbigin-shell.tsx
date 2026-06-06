import Link from 'next/link';
import {
    Calendar,
    Contact,
    GaugeCircle,
    Layers,
    Mail,
    Package,
    Phone,
} from 'lucide-react';

import { cn } from '@/components/sabcrm/20ui/compat';

/**
 * SabBigin top-nav. Minimal by design — the whole point of SabBigin is a
 * narrower surface than the full Sales CRM module.
 */

export const SABBIGIN_NAV: ReadonlyArray<{
    href: string;
    label: string;
    icon: React.ElementType;
}> = [
    { href: '/dashboard/sabbigin', label: 'Home', icon: GaugeCircle },
    { href: '/dashboard/sabbigin/pipeline', label: 'Pipeline', icon: Layers },
    { href: '/dashboard/sabbigin/contacts', label: 'Contacts', icon: Contact },
    { href: '/dashboard/sabbigin/products', label: 'Products', icon: Package },
    { href: '/dashboard/sabbigin/calls', label: 'Calls', icon: Phone },
    { href: '/dashboard/sabbigin/emails', label: 'Emails', icon: Mail },
    { href: '/dashboard/sabbigin/dashboard', label: 'Dashboard', icon: Calendar },
];

export function SabbiginNav({ active }: { active?: string }) {
    return (
        <nav
            aria-label="SabBigin navigation"
            className="flex flex-wrap items-center gap-1 border-b border-[var(--st-border)] pb-2"
        >
            {SABBIGIN_NAV.map(({ href, label, icon: Icon }) => {
                const isActive = active === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors',
                            isActive
                                ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
