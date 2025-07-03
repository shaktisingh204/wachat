
'use client';

import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createShortUrl, getShortUrls, deleteShortUrl } from '@/app/actions/url-shortener.actions';
import type { WithId, ShortUrl } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Link as LinkIcon, LoaderCircle, Copy, BarChart2, Trash2, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeDialog } from '@/components/wabasimplify/qr-code-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Shorten URL
        </Button>
    )
}

function DeleteButton({ urlId, onDeleted }: { urlId: string, onDeleted: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteShortUrl(urlId);
            if(result.success) {
                toast({ title: "Success", description: "URL deleted." });
                onDeleted();
            } else {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            }
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the short link. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function ShortenerPageSkeleton() {
    return (
        <div className="space-y-8">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export default function UrlShortenerPage() {
    const [urls, setUrls] = useState<WithId<ShortUrl>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const { toast } = useToast();
    const [state, formAction] = useActionState(createShortUrl, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { isCopied, copy } = useCopyToClipboard();
    const [selectedUrlForQr, setSelectedUrlForQr] = useState<string | null>(null);

    const fetchUrls = useCallback(() => {
        if (!projectId) return;
        startLoadingTransition(async () => {
            const data = await getShortUrls(projectId);
            setUrls(data);
        });
    }, [projectId]);

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchUrls();
        }
    }, [projectId, fetchUrls]);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            formRef.current?.reset();
            fetchUrls();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: "destructive" });
        }
    }, [state, toast, fetchUrls]);
    
    const getShortUrl = (shortCode: string) => {
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/s/${shortCode}`;
    }

    if (!isClient) return <ShortenerPageSkeleton />;

    if (!projectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to use the URL Shortener.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <QrCodeDialog
                url={selectedUrlForQr}
                open={!!selectedUrlForQr}
                onOpenChange={(open) => !open && setSelectedUrlForQr(null)}
            />
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <LinkIcon className="h-8 w-8"/>
                        URL Shortener
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Create short, trackable links for your campaigns.
                    </p>
                </div>

                <Card className="card-gradient card-gradient-blue">
                    <form action={formAction} ref={formRef}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <CardHeader>
                            <CardTitle>Create a new short link</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="originalUrl">Destination URL</Label>
                                <Input id="originalUrl" name="originalUrl" type="url" placeholder="https://example.com/very-long-url-to-shorten" required/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="alias">Custom Alias (Optional)</Label>
                                <Input id="alias" name="alias" placeholder="e.g., summer-sale" />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <SubmitButton />
                        </CardFooter>
                    </form>
                </Card>

                <Card className="card-gradient card-gradient-purple">
                    <CardHeader>
                        <CardTitle>Your Links</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Short URL</TableHead>
                                        <TableHead>Destination</TableHead>
                                        <TableHead>Clicks</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                    : urls.length > 0 ? urls.map(url => (
                                        <TableRow key={url._id.toString()}>
                                            <TableCell className="font-mono text-sm flex items-center gap-2">
                                                <a href={getShortUrl(url.shortCode)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                    {getShortUrl(url.shortCode)}
                                                </a>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(getShortUrl(url.shortCode))}>
                                                    <Copy className="h-4 w-4"/>
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground truncate max-w-xs">{url.originalUrl}</TableCell>
                                            <TableCell>{url.clickCount}</TableCell>
                                            <TableCell>{new Date(url.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedUrlForQr(getShortUrl(url.shortCode))}><QrCode className="h-4 w-4"/></Button>
                                                <DeleteButton urlId={url._id.toString()} onDeleted={fetchUrls} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                    : <TableRow><TableCell colSpan={5} className="text-center h-24">No links created yet.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
