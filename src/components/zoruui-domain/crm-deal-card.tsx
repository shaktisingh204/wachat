'use client';

import { Avatar, ZoruAvatarFallback, Card } from '@/components/sabcrm/20ui/compat';
import Link from 'next/link';

import { User, Building, FolderKanban } from 'lucide-react';
import type { WithId, CrmDeal, CrmContact, CrmAccount } from '@/lib/definitions';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface CrmDealCardProps {
    deal: WithId<CrmDeal>;
    contact?: WithId<CrmContact>;
    account?: WithId<CrmAccount>;
    taskCount?: number;
    index: number;
}

export function CrmDealCard({ deal, contact, account, taskCount = 0, index }: CrmDealCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: deal._id.toString(),
        data: { index, deal },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Link href={`/dashboard/crm/deals/${deal._id.toString()}`}>
                <Card className="cursor-pointer block hover:shadow-md transition-shadow p-0">
                    <div className="p-3">
                        <h3 className="text-sm font-semibold text-[var(--st-text)]">{deal.name}</h3>
                    </div>
                    <div className="p-3 pt-0 text-sm space-y-2">
                        <p className="font-bold text-[var(--st-text)]">{new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD' }).format(deal.value)}</p>
                        {account && <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]"><Building className="h-3 w-3" /><span>{account.name}</span></div>}
                        {contact && <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]"><User className="h-3 w-3" /><span>{contact.name}</span></div>}
                    </div>
                    <div className="p-3 flex justify-between items-center border-t border-[var(--st-border)]">
                         <div className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                            <FolderKanban className="h-3 w-3" />
                            <span>{taskCount}</span>
                        </div>
                        <Avatar className="h-6 w-6">
                            <ZoruAvatarFallback>A</ZoruAvatarFallback>
                        </Avatar>
                    </div>
                </Card>
            </Link>
        </div>
    );
}
