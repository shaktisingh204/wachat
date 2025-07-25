
'use client';

import { useActionState, useEffect, useRef, useTransition, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookOpen, Key, Link2, LoaderCircle, Info, Trash2, CheckCircle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { addCustomDomain, getCustomDomains, verifyCustomDomain, deleteCustomDomain } from '@/app/actions/url-shortener.actions';
import type { WithId, CustomDomain } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Badge } from '@/components/ui/badge';


const addDomainInitialState = { success: undefined, error: undefined };

function AddDomainButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Domain
        </Button>
    )
}

function VerifyButton({ domainId }: { domainId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const onVerify = () => {
        startTransition(async () => {
            const result = await verifyCustomDomain(domainId);
            if (result.success) {
                toast({ title: "Domain Verified!", description: "You can now use this domain for your short links."});
            } else {
                toast({ title: "Verification Failed", description: result.error, variant: 'destructive'});
            }
        });
    };

    return <Button onClick={onVerify} size="sm" disabled={isPending}>{isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Verify</Button>;
}

function DeleteButton({ domainId }: { domainId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const onDelete = () => {
        startTransition(async () => {
            const result = await deleteCustomDomain(domainId);
            if (!result.success) {
                toast({ title: "Error", description: result.error, variant: "destructive"});
            }
        });
    }

    return <Button variant="ghost" size="icon" onClick={onDelete} disabled={isPending}>{isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}</Button>;
}


export default function UrlShortenerSettingsPage() {
    const { toast } = useToast();
    const addFormRef = useRef<HTMLFormElement>(null);
    const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [addState, addAction] = useActionState(addCustomDomain, addDomainInitialState);
    const { copy } = useCopyToClipboard();

     useEffect(() => {
        startLoadingTransition(async () => {
            const data = await getCustomDomains();
            setDomains(data);
        });
    }, [addState]);

    useEffect(() => {
        if (addState.success) {
            toast({ title: 'Domain Added', description: 'Please add the TXT record to your DNS provider to verify ownership.' });
            addFormRef.current?.reset();
        }
        if (addState.error) {
            toast({ title: 'Error', description: addState.error, variant: 'destructive' });
        }
    }, [addState, toast]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">URL Shortener Settings</h1>
                <p className="text-muted-foreground">Configure custom domains and developer settings for your short links.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Custom Domains</CardTitle>
                    <CardDescription>Use your own domain for branded short links (e.g., links.mybrand.com).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form action={addAction} ref={addFormRef} className="space-y-2">
                        <Label htmlFor="hostname">Your Domain</Label>
                        <div className="flex gap-2">
                            <Input id="hostname" name="hostname" placeholder="e.g., links.mybrand.com" required />
                            <AddDomainButton />
                        </div>
                    </form>

                    <Separator />
                     <div className="space-y-4">
                        {isLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : domains.length > 0 ? (
                            domains.map(domain => (
                                <div key={domain._id.toString()} className="p-4 border rounded-lg space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold">{domain.hostname}</p>
                                            {domain.verified ? (
                                                <Badge><CheckCircle className="mr-1 h-3 w-3" /> Verified</Badge>
                                            ) : (
                                                <Badge variant="secondary">Unverified</Badge>
                                            )}
                                        </div>
                                        <DeleteButton domainId={domain._id.toString()} />
                                    </div>
                                    {domain.verified ? (
                                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md text-sm space-y-3 border border-green-200 dark:border-green-800">
                                            <div className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
                                                <CheckCircle className="h-4 w-4"/>
                                                Domain ownership verified!
                                            </div>
                                            <p className="text-muted-foreground">Now, configure the CNAME record in your DNS provider to point your domain to our servers. This enables the short links.</p>
                                            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                                                <span className="text-muted-foreground">Type:</span> <span>CNAME</span>
                                                <span className="text-muted-foreground">Host/Name:</span> <span>{domain.hostname}</span>
                                                <span className="text-muted-foreground">Value/Target:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="break-all">cname.sabnode.com</span>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy('cname.sabnode.com')}><Copy className="h-3 w-3"/></Button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground pt-2">Note: DNS changes can take up to 24 hours to propagate. The 'Host' value may differ depending on your provider (e.g., 'links' instead of 'links.mybrand.com').</p>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-muted/50 rounded-md text-sm space-y-3">
                                            <p className="text-muted-foreground">To verify this domain, add the following TXT record to your DNS settings:</p>
                                            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                                                <span className="text-muted-foreground">Type:</span> <span>TXT</span>
                                                <span className="text-muted-foreground">Host:</span> <span>@ or {domain.hostname}</span>
                                                <span className="text-muted-foreground">Value:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="break-all">{domain.verificationCode}</span>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy(domain.verificationCode)}><Key className="h-3 w-3"/></Button>
                                                </div>
                                            </div>
                                             <div className="flex justify-end pt-2">
                                                <VerifyButton domainId={domain._id.toString()} />
                                             </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-center text-muted-foreground py-4">No custom domains added yet.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Developer Options</CardTitle>
                    <CardDescription>For programmatic access and integrations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <div className="flex gap-2">
                            <Input id="apiKey" name="apiKey" value="********************************" disabled />
                            <Button type="button" variant="secondary" disabled>Regenerate</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Programmatic URL creation via API is coming soon.</p>
                    </div>
                </CardContent>
                 <CardFooter>
                     <Button type="button" variant="outline" disabled>
                        <BookOpen className="mr-2 h-4 w-4" /> View API Docs
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
}
