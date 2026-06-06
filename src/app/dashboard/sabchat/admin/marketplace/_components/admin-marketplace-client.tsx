'use client';

import { useState } from 'react';
import { PackageX } from 'lucide-react';
import {
    Button,
    Card,
    CardBody,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    EmptyState,
    useToast,
} from '@/components/sabcrm/20ui';
import { installMarketplaceApp, uninstallMarketplaceApp } from '@/app/actions/sabchat-admin.actions';

export function AdminMarketplaceClient({ initialData }: { initialData: any[] }) {
    const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    async function handleInstall(id: string) {
        setIsSubmitting(prev => ({ ...prev, [id]: true }));
        try {
            await installMarketplaceApp(id);
            toast.success('App installed.');
        } catch {
            toast.error('Could not install the app.');
        } finally {
            setIsSubmitting(prev => ({ ...prev, [id]: false }));
        }
    }

    async function handleUninstall(id: string) {
        if (!confirm('Are you sure you want to uninstall this app?')) return;
        setIsSubmitting(prev => ({ ...prev, [id]: true }));
        try {
            await uninstallMarketplaceApp(id);
            toast.success('App uninstalled.');
        } catch {
            toast.error('Could not uninstall the app.');
        } finally {
            setIsSubmitting(prev => ({ ...prev, [id]: false }));
        }
    }

    if (initialData.length === 0) {
        return (
            <div className="p-4">
                <EmptyState
                    icon={PackageX}
                    title="No marketplace apps available"
                    description="Apps you can install will appear here once they are published."
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
            {initialData.map((app) => (
                <Card key={app.id} className="flex flex-col">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        {app.iconUrl ? (
                            <img src={app.iconUrl} alt={app.name} className="w-10 h-10 rounded-[var(--st-radius)] object-contain" />
                        ) : (
                            <div className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] flex items-center justify-center font-bold text-lg shrink-0 text-[var(--st-text)]">
                                {app.name.charAt(0)}
                            </div>
                        )}
                        <div className="flex-1">
                            <CardTitle className="text-base">{app.name}</CardTitle>
                            <CardDescription className="text-xs">{app.provider}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardBody className="flex-1 text-sm text-[var(--st-text-secondary)] pt-4">
                        {app.description}
                    </CardBody>
                    <CardFooter>
                        {app.installed ? (
                            <Button
                                variant="danger"
                                block
                                onClick={() => handleUninstall(app.id)}
                                loading={isSubmitting[app.id]}
                            >
                                Uninstall
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                block
                                onClick={() => handleInstall(app.id)}
                                loading={isSubmitting[app.id]}
                            >
                                Install
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
