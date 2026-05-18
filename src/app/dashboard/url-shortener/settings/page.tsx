'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSeparator,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useTransition,
  useState,
  useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { Key,
  LoaderCircle,
  Trash2,
  CheckCircle,
  Copy,
  BookOpen,
  AlertTriangle,
  Globe } from 'lucide-react';
import { addCustomDomain,
  getCustomDomains,
  verifyCustomDomain,
  deleteCustomDomain } from '@/app/actions/url-shortener.actions';
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
    const { toast } = useZoruToast();

    const onVerify = () => {
        startTransition(async () => {
            const result = await verifyCustomDomain(domainId);
            if (result.success) {
                toast({ title: "Domain Verified!", description: "You can now use this domain for your short links." });
                onActionComplete();
            } else {
                toast({ title: "Verification Failed", description: result.error, variant: 'destructive' });
            }
        });
    };

    return <ZoruButton onClick={onVerify} size="sm" disabled={isPending}>{isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Verify DNS</ZoruButton>;
}

function DeleteButton({ domainId, onActionComplete }: { domainId: string, onActionComplete: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const onDelete = () => {
        startTransition(async () => {
            const result = await deleteCustomDomain(domainId);
            if (result.success) {
                toast({ title: 'Success', description: 'Domain deleted.' });
                onActionComplete();
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    }

    return <ZoruButton variant="ghost" size="icon" onClick={onDelete} disabled={isPending}>{isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-zoru-danger-ink" />}</ZoruButton>;
}

export default function UrlShortenerSettingsPage() {
    const { toast } = useZoruToast();
    const addFormRef = useRef<HTMLFormElement>(null);
    const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [addState, addAction] = useActionState(addCustomDomain, addDomainInitialState);
    const { copy } = useCopyToClipboard();

    const fetchData = useCallback(() => {
        startLoadingTransition(async () => {
            const data = await getCustomDomains();
            setDomains(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (addState.success) {
            toast({ title: 'Domain Added', description: 'Please add the TXT record to your DNS provider to verify ownership.' });
            addFormRef.current?.reset();
            fetchData(); // Re-fetch after adding
        }
        if (addState.error) {
            toast({ title: 'Error', description: addState.error, variant: 'destructive' });
        }
    }, [addState, toast, fetchData]);

    return (
        <div className="flex flex-col gap-8 max-w-5xl">
            <div>
                <h1 className="text-3xl text-zoru-ink">URL Shortener Settings</h1>
                <p className="text-zoru-ink-muted">Configure custom domains and developer settings for your short links.</p>
            </div>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Custom Domains</ZoruCardTitle>
                    <ZoruCardDescription>Use your own domain for branded short links (e.g., links.mybrand.com). You must own the domain and be able to configure its DNS records.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                    <form action={addAction} ref={addFormRef} className="space-y-2">
                        <ZoruLabel htmlFor="hostname">Add New Domain</ZoruLabel>
                        <div className="flex gap-2">
                            <ZoruInput id="hostname" name="hostname" placeholder="e.g., links.mybrand.com" required className="max-w-md" />
                            <AddDomainButton />
                        </div>
                    </form>

                    <ZoruSeparator />
                    <div className="space-y-4">
                        <h4 className="text-zoru-ink">Your Domains</h4>
                        {isLoading ? (
                            <ZoruSkeleton className="h-24 w-full" />
                        ) : domains.length > 0 ? (
                            domains.map(domain => (
                                <div key={domain._id.toString()} className="p-4 border border-zoru-line rounded-lg space-y-4 bg-zoru-bg">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <p className="text-lg text-zoru-ink">{domain.hostname}</p>
                                            {domain.verified ? (
                                                <ZoruBadge variant="success"><CheckCircle className="mr-1 h-3 w-3" /> Verified</ZoruBadge>
                                            ) : (
                                                <ZoruBadge variant="danger">Unverified</ZoruBadge>
                                            )}
                                        </div>
                                        <DeleteButton domainId={domain._id.toString()} onActionComplete={fetchData} />
                                    </div>

                                    {!domain.verified && (
                                        <ZoruAlert className="border-zoru-warning/40 bg-zoru-warning/10">
                                            <AlertTriangle className="h-4 w-4 text-zoru-warning-ink" />
                                            <ZoruAlertTitle className="text-zoru-warning-ink">Action Required: Verify Domain Ownership</ZoruAlertTitle>
                                            <ZoruAlertDescription className="text-zoru-warning-ink mt-2">
                                                Please add a <strong>TXT record</strong> to your DNS configuration to verify you own this domain.
                                                <div className="mt-3 p-3 bg-zoru-bg rounded border border-zoru-warning/40 flex items-center justify-between gap-4">
                                                    <code className="font-mono text-xs">{domain.verificationCode}</code>
                                                    <ZoruButton variant="ghost" size="sm" onClick={() => copy(domain.verificationCode)}><Copy className="h-3 w-3" /></ZoruButton>
                                                </div>
                                                <p className="text-xs mt-2">After adding the record, click 'Verify DNS'. Record propagation usually takes a few minutes.</p>
                                            </ZoruAlertDescription>
                                        </ZoruAlert>
                                    )}

                                    {domain.verified ? (
                                        <div className="p-3 bg-zoru-success/10 rounded-md text-sm space-y-3 border border-zoru-success/40">
                                            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                                                <span className="text-zoru-ink-muted">DNS Status:</span> <span className="text-zoru-success-ink">Active & Verified</span>
                                                <span className="text-zoru-ink-muted">Usage:</span> <span>Use this domain when creating new short links.</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end pt-2">
                                            <VerifyButton domainId={domain._id.toString()} onActionComplete={fetchData} />
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 bg-zoru-surface-2 rounded-lg border border-dashed border-zoru-line">
                                <Globe className="h-8 w-8 mx-auto text-zoru-ink-muted mb-2" />
                                <p className="text-sm text-zoru-ink-muted">No custom domains added yet.</p>
                            </div>
                        )}
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Developer Options</ZoruCardTitle>
                    <ZoruCardDescription>Proprietary access for programmatic URL shortening.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="apiKey">API Key (Read-only)</ZoruLabel>
                        <div className="flex gap-2">
                            <ZoruInput id="apiKey" name="apiKey" value="sk_live_********************************" disabled />
                            <ZoruButton type="button" variant="outline" disabled>Regenerate</ZoruButton>
                        </div>
                        <p className="text-xs text-zoru-ink-muted">API access for creating short links is currently in closed beta.</p>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <ZoruButton type="button" variant="outline" disabled>
                        <BookOpen className="mr-2 h-4 w-4" /> View API Docs
                    </ZoruButton>
                </ZoruCardFooter>
            </ZoruCard>

        </div>
    );
}
