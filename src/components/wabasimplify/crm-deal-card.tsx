
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Building, FolderKanban } from 'lucide-react';
import type { WithId, CrmDeal, CrmContact, CrmAccount } from '@/lib/definitions';

interface CrmDealCardProps {
    deal: WithId<CrmDeal>;
    contact?: WithId<CrmContact>;
    account?: WithId<CrmAccount>;
    taskCount?: number;
}

export function CrmDealCard({ deal, contact, account, taskCount = 0 }: CrmDealCardProps) {
    
    return (
        <Card className="bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="p-3">
                <CardTitle className="text-sm font-semibold">{deal.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-sm space-y-2">
                <p className="font-bold text-primary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD' }).format(deal.value)}</p>
                {account && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building className="h-3 w-3" /><span>{account.name}</span></div>}
                {contact && <div className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3 w-3" /><span>{contact.name}</span></div>}
            </CardContent>
            <CardFooter className="p-3 flex justify-between items-center">
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderKanban className="h-3 w-3" />
                    <span>{taskCount}</span>
                </div>
                <Avatar className="h-6 w-6">
                    <AvatarFallback>A</AvatarFallback>
                </Avatar>
            </CardFooter>
        </Card>
    );
}
