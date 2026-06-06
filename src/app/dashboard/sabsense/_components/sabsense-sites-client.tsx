'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Globe, Trash2, KeyRound, Copy } from 'lucide-react';

import { Button, Card, CardBody, CardHeader, CardTitle, CardDescription, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, PageHeader, PageTitle, PageDescription, PageActions, Table, THead, TBody, Tr, Th, Td, Badge, EmptyState, useToast } from '@/components/sabcrm/20ui';

import {
    createPagesenseSite,
    deletePagesenseSite,
} from '@/app/actions/sabsense.actions';
import type { PagesenseSite } from '@/lib/rust-client/pagesense-sites';

export function PagesenseSitesClient({ initialSites }: { initialSites: PagesenseSite[] }) {
    const [sites, setSites] = useState(initialSites);
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [pending, startTransition] = useTransition();
    const [snippetSite, setSnippetSite] = useState<PagesenseSite | null>(null);
    const { toast } = useToast();

    const handleCreate = () => {
        if (!name.trim() || !domain.trim()) {
            toast({ title: 'Missing fields', description: 'Name and domain are required.', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const res = await createPagesenseSite({ name, domain });
            if (res.success) {
                toast({ title: 'Site created' });
                setIsOpen(false);
                setName('');
                setDomain('');
                // server action revalidates the path; force refresh via location for now
                if (typeof window !== 'undefined') window.location.reload();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const res = await deletePagesenseSite(id);
            if (res.success) {
                setSites((prev) => prev.filter((s) => s._id !== id));
                toast({ title: 'Site archived' });
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const copy = (text: string) => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard?.writeText(text);
            toast({ title: 'Copied' });
        }
    };

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <PageTitle>PageSense</PageTitle>
                <PageDescription>
                    Conversion-rate optimization — heatmaps, funnels, session
                    recordings, and form analytics for your sites.
                </PageDescription>
                <PageActions>
                    <Button onClick={() => setIsOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New site
                    </Button>
                </PageActions>
            </PageHeader>

            {sites.length === 0 ? (
                <EmptyState
                    icon={Globe}
                    title="No sites yet"
                    description="Register a site to start collecting heatmaps and recordings."
                    action={
                        <Button onClick={() => setIsOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New site
                        </Button>
                    }
                />
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Registered sites</CardTitle>
                        <CardDescription>
                            Click a site to view its heatmaps, funnels, and recordings.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Domain</Th>
                                    <Th>Status</Th>
                                    <Th className="text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {sites.map((s) => (
                                    <Tr key={s._id}>
                                        <Td>
                                            <Link
                                                href={`/dashboard/pagesense/${s._id}/heatmaps`}
                                                className="font-medium text-[color:var(--st-text)] hover:underline"
                                            >
                                                {s.name}
                                            </Link>
                                        </Td>
                                        <Td className="font-mono text-xs">
                                            {s.domain}
                                        </Td>
                                        <Td>
                                            <Badge variant={s.isActive ? 'default' : 'secondary'}>
                                                {s.isActive ? 'Active' : 'Paused'}
                                            </Badge>
                                        </Td>
                                        <Td className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSnippetSite(s)}
                                            >
                                                <KeyRound className="mr-2 h-4 w-4" /> Snippet
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(s._id)}
                                                disabled={pending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}

            {/* Create dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Register a new site</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="ps-name">Site name</Label>
                            <Input
                                id="ps-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Acme marketing site"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ps-domain">Domain</Label>
                            <Input
                                id="ps-domain"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                placeholder="acme.example.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={pending}>
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Snippet install dialog */}
            <Dialog open={!!snippetSite} onOpenChange={(o) => !o && setSnippetSite(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Install snippet</DialogTitle>
                    </DialogHeader>
                    {snippetSite && (
                        <div className="space-y-3 py-2">
                            <p className="text-sm text-[color:var(--st-text-secondary)]">
                                Add this snippet to the &lt;head&gt; of every page on
                                <span className="font-mono"> {snippetSite.domain}</span>.
                            </p>
                            <pre className="rounded-md bg-[color:var(--st-bg-muted)] p-3 text-xs overflow-x-auto">
{`<script async
  src="/pagesense-snippet.js"
  data-snippet-key="${snippetSite.snippetKey}"
  data-endpoint="/api/pagesense/ingest"
></script>`}
                            </pre>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copy(snippetSite.snippetKey)}
                            >
                                <Copy className="mr-2 h-4 w-4" /> Copy snippet key
                            </Button>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setSnippetSite(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
