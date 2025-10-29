
'use client';

import { getSession } from '@/app/actions';
import { SabChatWidgetGenerator } from '@/components/wabasimplify/sabchat-widget-generator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function SabChatWidgetPage() {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getSession().then(session => {
            setUser(session?.user);
            setIsLoading(false);
        });
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!user) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>
                    You must be logged in to configure the chat widget.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <SabChatWidgetGenerator user={user} />
    )
}
