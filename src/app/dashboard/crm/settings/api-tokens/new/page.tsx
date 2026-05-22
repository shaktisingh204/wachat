'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Check,
  Copy,
  KeyRound,
  LoaderCircle } from 'lucide-react';

/**
 * CRM Settings — Create new API token (Phase 7 foundation).
 *
 * The plain-text token is shown EXACTLY ONCE here, then disappears forever.
 * The user must copy it before navigating away.
 */

import * as React from 'react';
import Link from 'next/link';

import { EnumFormField } from '@/components/crm/enum-form-field';
import {
    generateApiToken,
} from '@/app/actions/crm-api-tokens.actions';
import {
    ALL_CRM_SCOPES,
    CRM_API_ENTITIES,
    type OAuthScope,
} from '@/lib/api/oauth-scopes';

export default function NewCrmApiTokenPage() {
    const router = useRouter();
    const toast = useZoruToast();

    const [name, setName] = React.useState('');
    const [selectedScopes, setSelectedScopes] = React.useState<Set<OAuthScope>>(
        () => new Set(),
    );
    const [expiry, setExpiry] = React.useState<string>('90');
    const [submitting, setSubmitting] = React.useState(false);
    const [issuedToken, setIssuedToken] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);

    const toggleScope = (s: OAuthScope) => {
        setSelectedScopes((prev) => {
            const next = new Set(prev);
            if (next.has(s)) next.delete(s);
            else next.add(s);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.toast({
                title: 'Name required',
                description: 'Give your token a descriptive name.',
                variant: 'destructive',
            });
            return;
        }
        if (selectedScopes.size === 0) {
            toast.toast({
                title: 'No scopes selected',
                description: 'Pick at least one scope.',
                variant: 'destructive',
            });
            return;
        }
        setSubmitting(true);
        try {
            const expiresInDays = expiry === 'never' ? null : Number(expiry);
            const res = await generateApiToken({
                name: name.trim(),
                scopes: Array.from(selectedScopes),
                expiresInDays,
            });
            if (!res.ok) {
                toast.toast({
                    title: 'Failed to create',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            setIssuedToken(res.token);
            toast.toast({ title: 'Token created — copy it now.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!issuedToken) return;
        try {
            await navigator.clipboard.writeText(issuedToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.toast({
                title: 'Copy failed',
                description: 'Select the token and copy manually.',
                variant: 'destructive',
            });
        }
    };

    if (issuedToken) {
        return (
            <div className="flex min-h-full flex-col gap-6">
                <PageHeader>
                    <ZoruPageHeading>
                        <KeyRound className="size-5" />
                        <ZoruPageTitle>Token created</ZoruPageTitle>
                    </ZoruPageHeading>
                </PageHeader>

                <Alert variant="destructive">
                    <ZoruAlertTitle>Copy this token now</ZoruAlertTitle>
                    <ZoruAlertDescription>
                        This is the only time the full token will be displayed. Once you
                        leave this page, it cannot be retrieved.
                    </ZoruAlertDescription>
                </Alert>

                <Card className="p-4">
                    <div className="font-mono text-sm break-all rounded-md bg-muted p-3">
                        {issuedToken}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button onClick={handleCopy}>
                            {copied ? (
                                <>
                                    <Check className="mr-2 size-4" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="mr-2 size-4" />
                                    Copy
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push('/dashboard/crm/settings/api-tokens')}
                        >
                            I&apos;ve saved it
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/crm/settings/api-tokens">
                            API Tokens
                        </ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>New</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <ZoruPageHeading>
                    <KeyRound className="size-5" />
                    <ZoruPageTitle>New API Token</ZoruPageTitle>
                </ZoruPageHeading>
                <ZoruPageDescription>
                    Tokens grant programmatic access to the CRM public REST API.
                </ZoruPageDescription>
            </PageHeader>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <Card className="space-y-4 p-4">
                    <div>
                        <Label htmlFor="token-name">Name</Label>
                        <Input
                            id="token-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Zapier integration"
                            disabled={submitting}
                        />
                    </div>
                    <div>
                        <Label htmlFor="expiry">Expiry</Label>
                        <EnumFormField
                            name="__expiry"
                            enumName="tokenExpiry"
                            initialId={expiry}
                            onChange={(id) => setExpiry(id ?? '30')}
                        />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <Label>Scopes</Label>
                        <span className="text-sm text-muted-foreground">
                            {selectedScopes.size} selected
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {CRM_API_ENTITIES.map((entity) => {
                            const read = `crm:read:${entity}` as OAuthScope;
                            const write = `crm:write:${entity}` as OAuthScope;
                            return (
                                <div key={entity} className="space-y-2">
                                    <div className="font-medium text-sm capitalize">
                                        {entity.replace('-', ' ')}
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={selectedScopes.has(read)}
                                            onCheckedChange={() => toggleScope(read)}
                                            disabled={submitting}
                                        />
                                        <span className="font-mono text-xs">{read}</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={selectedScopes.has(write)}
                                            onCheckedChange={() => toggleScope(write)}
                                            disabled={submitting}
                                        />
                                        <span className="font-mono text-xs">{write}</span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <div className="flex gap-2">
                    <Button type="submit" disabled={submitting}>
                        {submitting && (
                            <LoaderCircle className="mr-2 size-4 animate-spin" />
                        )}
                        Generate token
                    </Button>
                    <Link href="/dashboard/crm/settings/api-tokens">
                        <Button type="button" variant="outline" disabled={submitting}>
                            Cancel
                        </Button>
                    </Link>
                </div>

                {/* Reference: full scope catalogue for power users */}
                <p className="text-xs text-muted-foreground">
                    {ALL_CRM_SCOPES.length} scopes available. Tokens with the wildcard
                    {` `}
                    <code className="font-mono">crm:*</code> scope are not creatable from
                    this UI.
                </p>
            </form>
        </div>
    );
}
