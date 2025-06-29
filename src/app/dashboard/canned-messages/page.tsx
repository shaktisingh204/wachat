
'use client';

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import type { WithId } from 'mongodb';
import Link from 'next/link';
import { getCannedMessages, getProjects, deleteCannedMessage, CannedMessage } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Search, ClipboardList, Star, Trash2, Edit, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '@/hooks/use-toast';
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
import { CannedMessageFormDialog } from '@/components/wabasimplify/canned-message-form-dialog';
import { Badge } from '@/components/ui/badge';

export default function CannedMessagesPage() {
    const [cannedMessages, setCannedMessages] = useState<WithId<CannedMessage>[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleting, startDeleteTransition] = useTransition();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<WithId<CannedMessage> | null>(null);

    const fetchData = useCallback(async () => {
        const projectId = localStorage.getItem('activeProjectId');
        setActiveProjectId(projectId);
        if (projectId) {
            setLoading(true);
            const data = await getCannedMessages(projectId);
            setCannedMessages(data);
            setLoading(false);
        } else {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsClient(true);
        document.title = 'Canned Messages | Wachat';
    }, []);

    useEffect(() => {
        if (isClient) {
            fetchData();
        }
    }, [isClient, fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
    }, 300);

    const filteredMessages = useMemo(() => {
        return cannedMessages.filter(msg => msg.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [cannedMessages, searchQuery]);

    const handleDelete = (id: string) => {
        startDeleteTransition(async () => {
            const result = await deleteCannedMessage(id);
            if (result.success) {
                toast({ title: 'Success', description: 'Canned message deleted.' });
                fetchData();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const handleEdit = (message: WithId<CannedMessage>) => {
        setEditingMessage(message);
        setIsFormOpen(true);
    };

    const handleCreateNew = () => {
        setEditingMessage(null);
        setIsFormOpen(true);
    };
    
    const onFormSubmit = () => {
        setIsFormOpen(false);
        setEditingMessage(null);
        fetchData();
    }

    if (!isClient) {
        return <Skeleton className="h-full w-full" />;
    }

    if (!activeProjectId) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Canned Messages</h1>
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to manage canned messages.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <>
            <CannedMessageFormDialog
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                projectId={activeProjectId}
                existingMessage={editingMessage}
                onSubmitted={onFormSubmit}
            />
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Canned Messages</h1>
                    <p className="text-muted-foreground">
                        Create and manage message templates to use in your live chat conversations.
                    </p>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Quick Guide</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p>You can save canned message templates and use them in live chat.</p>
                        <p>For media types (Image, Video, etc.), provide a public URL to the file.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <CardTitle>Your Canned Messages</CardTitle>
                                <CardDescription>A list of all saved messages for this project.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                 <div className="relative w-full sm:w-auto">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name..."
                                        className="pl-8 w-full sm:w-64"
                                        onChange={(e) => handleSearch(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleCreateNew}>
                                    <PlusCircle className="mr-2 h-4 w-4"/>
                                    Create New
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Content</TableHead>
                                        <TableHead>Created By</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredMessages.length > 0 ? (
                                        filteredMessages.map(msg => (
                                            <TableRow key={msg._id.toString()}>
                                                <TableCell>
                                                    {msg.isFavourite && <Star className="h-5 w-5 text-amber-400 fill-amber-400" />}
                                                </TableCell>
                                                <TableCell className="font-medium">{msg.name}</TableCell>
                                                <TableCell><Badge variant="outline" className="capitalize">{msg.type}</Badge></TableCell>
                                                <TableCell className="text-muted-foreground truncate max-w-xs">{msg.content.text || msg.content.mediaUrl}</TableCell>
                                                <TableCell className="text-muted-foreground">{msg.createdBy}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(msg)}><Edit className="h-4 w-4"/></Button>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently delete the "{msg.name}" canned message.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(msg._id.toString())} disabled={isDeleting}>
                                                                    {isDeleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null} Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">No canned messages found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                         </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
