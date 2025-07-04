
'use client';

import { useEffect, useState, useTransition, useActionState, useRef, useMemo, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { createShortUrl, getShortUrls, deleteShortUrl, getCustomDomains } from '@/app/actions/url-shortener.actions';
import type { WithId, ShortUrl, User, Tag, CustomDomain } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Link as LinkIcon, LoaderCircle, Copy, BarChart, Trash2, QrCode, ChevronsUpDown, Check } from 'lucide-react';
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
import { BulkImportDialog } from '@/components/wabasimplify/bulk-url-import-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function TagsSelector({ userTags, onSelectionChange }: { userTags: Tag[], onSelectionChange: (tagIds: string[]) => void }) {
    const [open, setOpen] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    
    const handleSelect = (tagId: string) => {
        const newSelected = selectedTags.includes(tagId)
            ? selectedTags.filter(id => id !== tagId)
            : [...selectedTags, tagId];
        setSelectedTags(newSelected);
        onSelectionChange(newSelected);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className="truncate">
                        {selectedTags.length > 0
                            ? selectedTags.map(id => userTags.find(t => t._id === id)?.name).filter(Boolean).join(', ')
                            : "Select tags..."
                        }
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                        <CommandEmpty>No tags found. Manage tags in settings.</CommandEmpty>
                        <CommandGroup>
                             {userTags.map((tag) => (
                                <CommandItem
                                    key={tag._id}
                                    value={tag.name}
                                    onSelect={() => handleSelect(tag._id)}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", selectedTags.includes(tag._id) ? "opacity-100" : "opacity-0")} />
                                    <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                                    <span>{tag.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
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
    const [user, setUser] = useState<(Omit<User, 'password'> & { _id: string, tags?: Tag[] }) | null>(null);
    const [urls, setUrls] = useState<WithId<ShortUrl>[]>([]);
    const [domains, setDomains] = useState<WithId<CustomDomain>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();
    const [state, formAction] = useActionState(createShortUrl, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { copy } = useCopyToClipboard();
    const [selectedUrlForQr, setSelectedUrlForQr] = useState<string | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [expiresAt, setExpiresAt] = useState<Date | undefined>();

    const fetchUrls = useCallback(() => {
        startLoadingTransition(async () => {
            const { user: userData, urls: urlData, domains: domainData } = await getShortUrls();
            setUser(userData);
            setUrls(urlData);
            setDomains(domainData);
        });
    }, []);

    useEffect(() => {
        setIsClient(true);
        fetchUrls();
    }, [fetchUrls]);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            formRef.current?.reset();
            setSelectedTagIds([]);
            setExpiresAt(undefined);
            fetchUrls();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: "destructive" });
        }
    }, [state, toast, fetchUrls]);
    
    const getShortUrl = (url: WithId<ShortUrl>) => {
        if (typeof window === 'undefined') return '';
        const domain = domains.find(d => d._id.toString() === url.domainId)?.hostname || window.location.origin;
        const protocol = domain.startsWith('http') ? '' : 'https://';
        
        if(domain.startsWith('http')) {
            return `${domain}/s/${url.shortCode}`;
        }
        
        return url.domainId ? `${protocol}${domain}/${url.shortCode}` : `${domain}/s/${url.shortCode}`;
    }

    if (!isClient) return <ShortenerPageSkeleton />;

    if (!user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not Logged In</AlertTitle>
                <AlertDescription>
                    Please log in to use the URL Shortener.
                </AlertDescription>
            </Alert>
        );
    }
    
    const verifiedDomains = domains.filter(d => d.verified);

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
                        <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
                        <input type="hidden" name="expiresAt" value={expiresAt?.toISOString() || ''} />
                        <CardHeader>
                            <CardTitle>Create a new short link</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="originalUrl">Destination URL</Label>
                                    <Input id="originalUrl" name="originalUrl" type="url" placeholder="https://example.com/very-long-url-to-shorten" required/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="alias">Custom Alias (Optional)</Label>
                                    <Input id="alias" name="alias" placeholder="e.g., summer-sale" />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Tags (Optional)</Label>
                                    <TagsSelector userTags={user?.tags || []} onSelectionChange={setSelectedTagIds} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Expiration Date (Optional)</Label>
                                    <DatePicker date={expiresAt} setDate={setExpiresAt} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Custom Domain (Optional)</Label>
                                    <Select name="domainId">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Default" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Default Domain</SelectItem>
                                            {verifiedDomains.map(d => (
                                                <SelectItem key={d._id.toString()} value={d._id.toString()}>{d.hostname}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center">
                            <SubmitButton />
                            <BulkImportDialog onImportComplete={fetchUrls} />
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
                                        <TableHead>Expires</TableHead>
                                        <TableHead>Clicks</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                    : urls.length > 0 ? urls.map(url => (
                                        <TableRow key={url._id.toString()}>
                                            <TableCell className="font-mono text-sm">
                                                <a href={getShortUrl(url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    {getShortUrl(url).replace(/^https?:\/\//, '')}
                                                    <Copy className="h-3 w-3 inline-block ml-1 cursor-pointer" onClick={(e) => { e.preventDefault(); copy(getShortUrl(url)); }}/>
                                                </a>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground truncate max-w-[200px]">{url.originalUrl}</TableCell>
                                            <TableCell>{url.expiresAt ? new Date(url.expiresAt).toLocaleDateString() : 'Never'}</TableCell>
                                            <TableCell>{url.clickCount}</TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild variant="ghost" size="icon">
                                                    <Link href={`/dashboard/url-shortener/${url._id.toString()}`}><BarChart className="h-4 w-4"/></Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedUrlForQr(getShortUrl(url))}><QrCode className="h-4 w-4"/></Button>
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
