'use client';

import {
  Button,
  Input,
  Label,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Skeleton,
  Badge,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import {
  Target,
  Plus,
  Copy,
  RefreshCw,
  Eye,
  Trash2,
  Code2
} from 'lucide-react';
import Link from 'next/link';

import * as React from 'react';

import { AmBreadcrumb, AmHeader, AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { listPixels, createPixel } from '@/app/actions/ad-manager.actions';

export default function PixelsPage() {
    const { toast } = useToast();
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
                        <Button variant="outline" size="icon" onClick={load}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Dialog open={open} onOpenChange={setOpen}>
                            <ZoruDialogTrigger asChild>
                                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90">
                                    <Plus className="h-4 w-4 mr-1" /> Create pixel
                                </Button>
                            </ZoruDialogTrigger>
                            <ZoruDialogContent>
                                <ZoruDialogHeader>
                                    <ZoruDialogTitle>Create Meta Pixel</ZoruDialogTitle>
                                </ZoruDialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label>Pixel name</Label>
                                        <Input 
                                            placeholder="My Awesome Pixel" 
                                            value={name} 
                                            onChange={(e) => setName(e.target.value)} 
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This name will appear in your Events Manager.
                                        </p>
                                    </div>
                                </div>
                                <ZoruDialogFooter>
                                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                    <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
                                </ZoruDialogFooter>
                            </ZoruDialogContent>
                        </Dialog>
                    </div>
                }
            />

            {loading ? (
                <div className="grid md:grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
                </div>
            ) : pixels.length === 0 ? (
                <Card className="border-dashed">
                    <ZoruCardContent className="py-12 text-center space-y-3">
                        <Target className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="font-medium">No pixels yet</p>
                        <p className="text-sm text-muted-foreground">Create your first pixel to start tracking website activities and optimizing ads.</p>
                        <Button variant="outline" onClick={() => setOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Pixel
                        </Button>
                    </ZoruCardContent>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {pixels.map((p) => (
                        <Card key={p.id} className="transition-all hover:shadow-sm">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-base flex items-center justify-between">
                                    <span className="truncate pr-2" title={p.name}>{p.name}</span>
                                    {p.last_fired_time ? (
                                        <Badge variant="outline" className="text-green-600 bg-green-50 shrink-0">Active</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="shrink-0 text-xs font-normal">No Recent Activity</Badge>
                                    )}
                                </ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-4 pt-0">
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Pixel ID</Label>
                                    <div className="flex items-center gap-2 text-sm font-mono bg-muted/50 px-2 py-1.5 rounded border border-border/50">
                                        <span className="truncate flex-1 select-all">{p.id}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 hover:bg-background"
                                            onClick={() => {
                                                navigator.clipboard.writeText(p.id);
                                                toast({ title: 'Copied to clipboard', description: `Pixel ID: ${p.id}` });
                                            }}
                                            title="Copy ID"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                
                                {p.last_fired_time && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 px-2 py-1.5 rounded border border-border/30">
                                        <span className="h-2 w-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                                        Last event: {new Date(p.last_fired_time).toLocaleString()}
                                    </div>
                                )}
                                
                                <div className="flex flex-wrap items-center gap-2 pt-3 border-t mt-4">
                                    <Button variant="outline" size="sm" className="flex-1 text-xs h-8" asChild>
                                        <Link href={`/dashboard/ad-manager/events-manager?pixel=${p.id}`}>
                                            <Eye className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> 
                                            View Events
                                        </Link>
                                    </Button>
                                    
                                    <Dialog>
                                        <ZoruDialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="flex-1 text-xs h-8">
                                                <Code2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                                Install Code
                                            </Button>
                                        </ZoruDialogTrigger>
                                        <ZoruDialogContent className="sm:max-w-xl">
                                            <ZoruDialogHeader>
                                                <ZoruDialogTitle>Install Pixel Base Code</ZoruDialogTitle>
                                            </ZoruDialogHeader>
                                            <div className="space-y-4">
                                                <p className="text-sm text-muted-foreground">
                                                    Copy and paste this code at the bottom of the header section of your website, just above the <code className="bg-muted px-1 py-0.5 rounded">&lt;/head&gt;</code> tag.
                                                </p>
                                                <div className="relative">
                                                    <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground border">
{`<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${p.id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${p.id}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`}
                                                    </pre>
                                                    <Button 
                                                        size="sm" 
                                                        className="absolute top-2 right-2 h-7 text-xs"
                                                        onClick={() => {
                                                            const code = `<!-- Meta Pixel Code -->\\n<script>\\n!function(f,b,e,v,n,t,s)\\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\\nn.queue=[];t=b.createElement(e);t.async=!0;\\nt.src=v;s=b.getElementsByTagName(e)[0];\\ns.parentNode.insertBefore(t,s)}(window, document,'script',\\n'https://connect.facebook.net/en_US/fbevents.js');\\nfbq('init', '${p.id}');\\nfbq('track', 'PageView');\\n</script>\\n<noscript><img height="1" width="1" style="display:none"\\nsrc="https://www.facebook.com/tr?id=${p.id}&ev=PageView&noscript=1"\\n/></noscript>\\n<!-- End Meta Pixel Code -->`;
                                                            navigator.clipboard.writeText(code);
                                                            toast({ title: 'Code copied to clipboard' });
                                                        }}
                                                    >
                                                        <Copy className="h-3 w-3 mr-1" /> Copy
                                                    </Button>
                                                </div>
                                            </div>
                                        </ZoruDialogContent>
                                    </Dialog>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        title="Remove from view"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to remove this pixel from the list?')) {
                                                setPixels((prev) => prev.filter((px) => px.id !== p.id));
                                                toast({ title: 'Pixel removed', description: `${p.name} has been removed from this view.` });
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </ZoruCardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

