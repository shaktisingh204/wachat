'use client';

import { useState } from 'react';
import { 
    Button, Card, ZoruCardContent, ZoruCardDescription, ZoruCardFooter, ZoruCardHeader, ZoruCardTitle 
} from '@/components/zoruui';
import { installMarketplaceApp, uninstallMarketplaceApp } from '@/app/actions/sabchat-admin.actions';

export function AdminMarketplaceClient({ initialData }: { initialData: any[] }) {
    const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

    async function handleInstall(id: string) {
        setIsSubmitting(prev => ({ ...prev, [id]: true }));
        try {
            await installMarketplaceApp(id);
        } finally {
            setIsSubmitting(prev => ({ ...prev, [id]: false }));
        }
    }

    async function handleUninstall(id: string) {
        if (!confirm('Are you sure you want to uninstall this app?')) return;
        setIsSubmitting(prev => ({ ...prev, [id]: true }));
        try {
            await uninstallMarketplaceApp(id);
        } finally {
            setIsSubmitting(prev => ({ ...prev, [id]: false }));
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
            {initialData.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground p-8">
                    No marketplace apps available.
                </div>
            ) : (
                initialData.map((app) => (
                    <Card key={app.id} className="flex flex-col">
                        <ZoruCardHeader className="flex flex-row items-center gap-4 space-y-0">
                            {app.iconUrl ? (
                                <img src={app.iconUrl} alt={app.name} className="w-10 h-10 rounded-md object-contain" />
                            ) : (
                                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center font-bold text-lg shrink-0">
                                    {app.name.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1">
                                <ZoruCardTitle className="text-base">{app.name}</ZoruCardTitle>
                                <ZoruCardDescription className="text-xs">{app.provider}</ZoruCardDescription>
                            </div>
                        </ZoruCardHeader>
                        <ZoruCardContent className="flex-1 text-sm text-muted-foreground pt-4">
                            {app.description}
                        </ZoruCardContent>
                        <ZoruCardFooter>
                            {app.installed ? (
                                <Button 
                                    variant="destructive" 
                                    className="w-full" 
                                    onClick={() => handleUninstall(app.id)}
                                    disabled={isSubmitting[app.id]}
                                >
                                    {isSubmitting[app.id] ? 'Uninstalling...' : 'Uninstall'}
                                </Button>
                            ) : (
                                <Button 
                                    className="w-full" 
                                    onClick={() => handleInstall(app.id)}
                                    disabled={isSubmitting[app.id]}
                                >
                                    {isSubmitting[app.id] ? 'Installing...' : 'Install'}
                                </Button>
                            )}
                        </ZoruCardFooter>
                    </Card>
                ))
            )}
        </div>
    );
}
