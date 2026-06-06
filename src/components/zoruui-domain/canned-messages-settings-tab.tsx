'use client';

import { Card, CardBody, CardDescription, CardHeader, CardTitle, CardFooter, Button, Table, TBody, Td, Th, THead, Tr, Skeleton, Input, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Badge } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useMemo } from 'react';
import type { WithId } from 'mongodb';
import { getCannedMessages,
  deleteCannedMessage } from '@/app/actions/project.actions';
import type { CannedMessage,
  Project } from '@/lib/definitions';
import { PlusCircle, Search, Star, Trash2, Edit, LoaderCircle } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '@/hooks/use-toast';
import { CannedMessageFormDialog } from '@/components/zoruui-domain/canned-message-form-dialog';

interface CannedMessagesSettingsTabProps {
  project: WithId<Project>;
}

export function CannedMessagesSettingsTab({ project }: CannedMessagesSettingsTabProps) {
    const [cannedMessages, setCannedMessages] = useState<WithId<CannedMessage>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleting, startDeleteTransition] = useTransition();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMessage, setEditingMessage] = useState<WithId<CannedMessage> | null>(null);

    const fetchData = useCallback(async () => {
        startLoadingTransition(async () => {
            const data = await getCannedMessages(project._id.toString());
            setCannedMessages(data);
        });
    }, [project, startLoadingTransition]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    return (
        <>
            <CannedMessageFormDialog
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                projectId={project._id.toString()}
                existingMessage={editingMessage}
                onSubmitted={onFormSubmit}
            />
            <Card className="card-gradient card-gradient-purple">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <CardTitle>Your Canned Messages</CardTitle>
                            <CardDescription>A list of all saved messages for this project. Use them in Live Chat.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
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
                <CardBody>
                    {/* Desktop View */}
                    <div className="hidden md:block border rounded-md">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th className="w-12"></Th>
                                    <Th>Name</Th>
                                    <Th>Type</Th>
                                    <Th>Content</Th>
                                    <Th>Created By</Th>
                                    <Th className="text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <Tr key={i}>
                                            <Td colSpan={6}><Skeleton className="h-8 w-full"/></Td>
                                        </Tr>
                                    ))
                                ) : filteredMessages.length > 0 ? (
                                    filteredMessages.map(msg => (
                                        <Tr key={msg._id.toString()}>
                                            <Td>
                                                {msg.isFavourite && <Star className="h-5 w-5 text-[var(--st-text-secondary)] fill-[var(--st-text-secondary)]" />}
                                            </Td>
                                            <Td className="font-medium">{msg.name}</Td>
                                            <Td><Badge variant="outline" className="capitalize">{msg.type}</Badge></Td>
                                            <Td className="text-[var(--st-text-secondary)] truncate max-w-xs">{msg.content.text || msg.content.mediaUrl}</Td>
                                            <Td className="text-[var(--st-text-secondary)]">{msg.createdBy}</Td>
                                            <Td className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(msg)}><Edit className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-[var(--st-text)]"/></Button>
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
                                            </Td>
                                        </Tr>
                                    ))
                                ) : (
                                    <Tr>
                                        <Td colSpan={6} className="h-24 text-center">No canned messages found.</Td>
                                    </Tr>
                                )}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                             [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full"/>)
                        ) : filteredMessages.length > 0 ? (
                            filteredMessages.map(msg => (
                                <Card key={msg._id.toString()}>
                                    <CardHeader className="flex flex-row justify-between items-start p-4">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {msg.isFavourite && <Star className="h-5 w-5 text-[var(--st-text-secondary)] fill-[var(--st-text-secondary)]" />}
                                                {msg.name}
                                            </CardTitle>
                                            <CardDescription>
                                                <Badge variant="outline" className="capitalize mt-1">{msg.type}</Badge>
                                            </CardDescription>
                                        </div>
                                        <div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(msg)}><Edit className="h-4 w-4"/></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-[var(--st-text)]"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the "{msg.name}" canned message.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(msg._id.toString())} disabled={isDeleting}>{isDeleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null} Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </CardHeader>
                                    <CardBody className="p-4 pt-0">
                                        <p className="text-sm text-[var(--st-text-secondary)] truncate">{msg.content.text || msg.content.mediaUrl}</p>
                                    </CardBody>
                                    <CardFooter className="p-4 pt-0 text-xs text-[var(--st-text-secondary)]">
                                        Created by: {msg.createdBy}
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <div className="h-24 text-center flex items-center justify-center">
                                No canned messages found.
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>
        </>
    );
}
