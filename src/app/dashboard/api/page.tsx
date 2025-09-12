
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getApiKeysForUser } from '@/app/actions/api-keys.actions';
import type { ApiKey } from '@/lib/definitions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, PlusCircle, Code, Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { GenerateApiKeyDialog } from '@/components/wabasimplify/generate-api-key-dialog';
import { ApiKeyList } from '@/components/wabasimplify/api-key-list';
import Link from 'next/link';

export default function ApiKeysPage() {
    const [keys, setKeys] = useState<Omit<ApiKey, 'key'>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchKeys = () => {
        startLoading(async () => {
            const keysData = await getApiKeysForUser();
            setKeys(keysData);
        });
    };

    useEffect(() => {
        document.title = "API Keys | SabNode";
        fetchKeys();
    }, []);

    return (
        <>
            <GenerateApiKeyDialog 
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onKeyGenerated={fetchKeys}
            />
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                            <Server className="h-8 w-8" />
                            API & Webhooks
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage your API keys for programmatic access and view webhook endpoints.
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard/api/docs">
                                <Code className="mr-2 h-4 w-4" />
                                API Documentation
                            </Link>
                        </Button>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New API Key
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5"/>Your API Keys</CardTitle>
                        <CardDescription>These keys grant access to your SabNode account data. Treat them like passwords.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-48 w-full" />
                        ) : (
                            <ApiKeyList keys={keys} onKeyRevoked={fetchKeys} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
