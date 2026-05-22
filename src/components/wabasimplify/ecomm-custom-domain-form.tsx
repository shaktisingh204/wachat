'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
  Separator,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Skeleton,
  Badge,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useTransition,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Key, LoaderCircle, Trash2, CheckCircle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCustomDomain, getCustomDomains, verifyCustomDomain, deleteCustomDomain } from '@/app/actions/url-shortener.actions';
import type { WithId,
  CustomDomain } from '@/lib/definitions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

const addDomainInitialState = { success: undefined, error: undefined };

function AddDomainButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Domain
        </ZoruButton>
    )
}

function VerifyButton({ domainId, onActionComplete }: { domainId: string, onActionComplete: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    const onVerify = () => {
        startTransition(async () => {
            const result = await verifyCustomDomain(domainId);
            if (result.success) {
                toast({ title: "Domain Verified!", description: "You can now use this domain for your shop."});
                onActionComplete();
            } else {
                toast({ title: "Verification Failed", description: result.error, variant: 'destructive'});
            }
        });
    };

    return <ZoruButton onClick={onVerify} size="sm" disabled={isPending}>{isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Verify</ZoruButton>;
}

function DeleteButton({ domainId, onActionComplete }: { domainId: string, onActionComplete: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const onDelete = () => {
        startTransition(async () => {
            const result = await deleteCustomDomain(domainId);
            if (!result.success) {
                toast({ title: "Error", description: result.error, variant: "destructive"});
            } else {
                onActionComplete();
            }
        });
    }

    return <ZoruButton variant="ghost" size="icon" onClick={onDelete} disabled={isPending}>{isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}</ZoruButton>;
}

export function EcommCustomDomainForm() {
    const { toast } = useToast();
    const addFormRef = useRef<HTMLFormElement>(null);
    const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [addState, addAction] = useActionState(addCustomDomain, addDomainInitialState);
    const { copy } = useCopyToClipboard();

     const fetchData = () => {
        startLoadingTransition(async () => {
            const data = await getCustomDomains();
            setDomains(data);
        });
    }

    useEffect(() => {
        fetchData();
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
        <ZoruCard>
            <ZoruCardHeader>
                <ZoruCardTitle>Custom Domains</ZoruCardTitle>
                <ZoruCardDescription>Use your own domain for branded shop URLs (e.g., shop.mybrand.com).</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-6">
                <form action={addAction} ref={addFormRef} className="space-y-2">
                    <ZoruLabel htmlFor="hostname">Add New Domain</ZoruLabel>
                    <div className="flex gap-2">
                        <ZoruInput id="hostname" name="hostname" placeholder="e.g., shop.mybrand.com" required />
                        <AddDomainButton />
                    </div>
                </form>

                <ZoruSeparator />
                 <div className="space-y-4">
                    <h4 className="font-medium">Your Domains</h4>
                    {isLoading ? (
                        <ZoruSkeleton className="h-24 w-full" />
                    ) : domains.length > 0 ? (
                        domains.map(domain => (
                            <div key={domain._id.toString()} className="p-4 border rounded-lg space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold">{domain.hostname}</p>
                                        {domain.verified ? (
                                            <ZoruBadge><CheckCircle className="mr-1 h-3 w-3" /> Verified</ZoruBadge>
                                        ) : (
                                            <ZoruBadge variant="secondary">Unverified</ZoruBadge>
                                        )}
                                    </div>
                                    <DeleteButton domainId={domain._id.toString()} onActionComplete={fetchData} />
                                </div>
                                {domain.verified ? (
                                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md text-sm space-y-3 border border-green-200 dark:border-green-800">
                                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                                            <span className="text-muted-foreground">Type:</span> <span>CNAME</span>
                                            <span className="text-muted-foreground">Host/Name:</span> <span>{domain.hostname}</span>
                                            <span className="text-muted-foreground">Value/Target:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="break-all">cname.sabnode.com</span>
                                                <ZoruButton variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy('cname.sabnode.com')}><Copy className="h-3 w-3"/></ZoruButton>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-muted/50 rounded-md text-sm space-y-3">
                                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                                            <span className="text-muted-foreground">Type:</span> <span>TXT</span>
                                            <span className="text-muted-foreground">Host:</span> <span>@ or {domain.hostname}</span>
                                            <span className="text-muted-foreground">Value:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="break-all">{domain.verificationCode}</span>
                                                <ZoruButton variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy(domain.verificationCode)}><Key className="h-3 w-3"/></ZoruButton>
                                            </div>
                                        </div>
                                         <div className="flex justify-end pt-2">
                                            <VerifyButton domainId={domain._id.toString()} onActionComplete={fetchData} />
                                         </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">No custom domains added yet.</p>
                    )}
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}
