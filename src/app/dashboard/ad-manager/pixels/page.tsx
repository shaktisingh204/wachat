'use client';

import {
  Button,
  IconButton,
  Field,
  Input,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
  Dot,
  EmptyState,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/sabcrm/20ui';
import {
  Target,
  Plus,
  Copy,
  RefreshCw,
  Eye,
  Trash2,
  Code2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import * as React from 'react';

import { AmBreadcrumb, AmHeader, AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { listPixels, createPixel } from '@/app/actions/ad-manager.actions';

export default function PixelsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { activeAccount } = useAdManager();
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [name, setName] = React.useState('');
    const [open, setOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const load = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const res = await listPixels(activeAccount.account_id);
        if (res.error) {
            toast({ title: 'Failed to load pixels', description: res.error, variant: 'destructive' });
            setPixels([]);
        } else {
            setPixels(res.data || []);
        }
        setLoading(false);
    }, [activeAccount, toast]);

    React.useEffect(() => {
        if (mounted) load();
    }, [load, mounted]);

    const handleCreate = async () => {
        if (!activeAccount || !name.trim()) return;
        const res = await createPixel(activeAccount.account_id, name.trim());
        if (res.error) {
            toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Pixel created' });
        setOpen(false);
        setName('');
        load();
    };

    const buildPixelCode = (id: string) =>
        `<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${id}');\nfbq('track', 'PageView');\n</script>\n<noscript><img height="1" width="1" style="display:none"\nsrc="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"\n/></noscript>\n<!-- End Meta Pixel Code -->`;

    if (!mounted) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-12 w-full" />
                <div className="grid md:grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-4">
                <AmBreadcrumb page="Pixels & datasets" />
                <AmErrorAlert message="Pick an ad account to view pixels." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Pixels & datasets" />
            <AmHeader
                title="Pixels & datasets"
                description="Track conversions, optimize delivery and build audiences from your website."
                actions={
                    <div className="flex gap-2">
                        <IconButton label="Refresh pixels" icon={RefreshCw} variant="outline" onClick={load} />
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button variant="primary" iconLeft={Plus}>Create pixel</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create Meta Pixel</DialogTitle>
                                </DialogHeader>
                                <div className="py-2">
                                    <Field
                                        label="Pixel name"
                                        help="This name will appear in your Events Manager."
                                    >
                                        <Input
                                            placeholder="My Awesome Pixel"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </Field>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="secondary">Cancel</Button>
                                    </DialogClose>
                                    <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                }
            />

            {loading ? (
                <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
                </div>
            ) : pixels.length === 0 ? (
                <Card variant="outlined" className="border-dashed">
                    <CardBody className="py-4">
                        <EmptyState
                            icon={Target}
                            title="No pixels yet"
                            description="Create your first pixel to start tracking website activities and optimizing ads."
                            action={
                                <Button variant="outline" iconLeft={Plus} onClick={() => setOpen(true)}>
                                    Create Pixel
                                </Button>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {pixels.map((p) => (
                        <Card key={p.id} variant="interactive">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span className="truncate pr-2" title={p.name}>{p.name}</span>
                                    {p.last_fired_time ? (
                                        <Badge tone="success" dot className="shrink-0">Active</Badge>
                                    ) : (
                                        <Badge tone="neutral" className="shrink-0 font-normal">No recent activity</Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="space-y-4 pt-0">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] text-[var(--st-text-secondary)] uppercase tracking-wider font-semibold">Pixel ID</span>
                                    <div className="flex items-center gap-2 text-sm font-mono bg-[var(--st-bg-secondary)] px-2 py-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                                        <span className="truncate flex-1 select-all">{p.id}</span>
                                        <IconButton
                                            label="Copy pixel ID"
                                            icon={Copy}
                                            size="sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(p.id);
                                                toast({ title: 'Copied to clipboard', description: `Pixel ID: ${p.id}` });
                                            }}
                                        />
                                    </div>
                                </div>

                                {p.last_fired_time && (
                                    <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1.5 bg-[var(--st-bg-secondary)] px-2 py-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                                        <Dot tone="success" pulse />
                                        Last event: {new Date(p.last_fired_time).toLocaleString()}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--st-border)] mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        iconLeft={Eye}
                                        className="flex-1"
                                        onClick={() => router.push(`/dashboard/ad-manager/events-manager?pixel=${p.id}`)}
                                    >
                                        View events
                                    </Button>

                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" iconLeft={Code2} className="flex-1">
                                                Install code
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-xl">
                                            <DialogHeader>
                                                <DialogTitle>Install Pixel Base Code</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                                <p className="text-sm text-[var(--st-text-secondary)]">
                                                    Copy and paste this code at the bottom of the header section of your website, just above the <code className="bg-[var(--st-bg-secondary)] px-1 py-0.5 rounded-[var(--st-radius)]">&lt;/head&gt;</code> tag.
                                                </p>
                                                <div className="relative">
                                                    <pre className="bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] text-xs font-mono overflow-x-auto whitespace-pre-wrap text-[var(--st-text-secondary)] border border-[var(--st-border)]">
{buildPixelCode(p.id)}
                                                    </pre>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        iconLeft={Copy}
                                                        className="absolute top-2 right-2"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(buildPixelCode(p.id));
                                                            toast({ title: 'Code copied to clipboard' });
                                                        }}
                                                    >
                                                        Copy
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    <IconButton
                                        label="Remove from view"
                                        icon={Trash2}
                                        size="sm"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to remove this pixel from the list?')) {
                                                setPixels((prev) => prev.filter((px) => px.id !== p.id));
                                                toast({ title: 'Pixel removed', description: `${p.name} has been removed from this view.` });
                                            }
                                        }}
                                    />
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
