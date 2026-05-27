'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardFooter,
  Button,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Skeleton,
  Input,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
} from '@/components/zoruui';
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
                <ZoruCardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <ZoruCardTitle>Your Canned Messages</ZoruCardTitle>
                            <ZoruCardDescription>A list of all saved messages for this project. Use them in Live Chat.</ZoruCardDescription>
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
                </ZoruCardHeader>
                <ZoruCardContent>
                    {/* Desktop View */}
                    <div className="hidden md:block border rounded-md">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead className="w-12"></ZoruTableHead>
                                    <ZoruTableHead>Name</ZoruTableHead>
                                    <ZoruTableHead>Type</ZoruTableHead>
                                    <ZoruTableHead>Content</ZoruTableHead>
                                    <ZoruTableHead>Created By</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    [...Array(3)].map((_, i) => (
                                        <ZoruTableRow key={i}>
                                            <ZoruTableCell colSpan={6}><Skeleton className="h-8 w-full"/></ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : filteredMessages.length > 0 ? (
                                    filteredMessages.map(msg => (
                                        <ZoruTableRow key={msg._id.toString()}>
                                            <ZoruTableCell>
                                                {msg.isFavourite && <Star className="h-5 w-5 text-amber-400 fill-amber-400" />}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-medium">{msg.name}</ZoruTableCell>
                                            <ZoruTableCell><Badge variant="outline" className="capitalize">{msg.type}</Badge></ZoruTableCell>
                                            <ZoruTableCell className="text-muted-foreground truncate max-w-xs">{msg.content.text || msg.content.mediaUrl}</ZoruTableCell>
                                            <ZoruTableCell className="text-muted-foreground">{msg.createdBy}</ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(msg)}><Edit className="h-4 w-4"/></Button>
                                                <ZoruAlertDialog>
                                                    <ZoruAlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </ZoruAlertDialogTrigger>
                                                    <ZoruAlertDialogContent>
                                                        <ZoruAlertDialogHeader>
                                                            <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
                                                            <ZoruAlertDialogDescription>This will permanently delete the "{msg.name}" canned message.</ZoruAlertDialogDescription>
                                                        </ZoruAlertDialogHeader>
                                                        <ZoruAlertDialogFooter>
                                                            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                            <ZoruAlertDialogAction onClick={() => handleDelete(msg._id.toString())} disabled={isDeleting}>
                                                                {isDeleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null} Delete
                                                            </ZoruAlertDialogAction>
                                                        </ZoruAlertDialogFooter>
                                                    </ZoruAlertDialogContent>
                                                </ZoruAlertDialog>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={6} className="h-24 text-center">No canned messages found.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                             [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full"/>)
                        ) : filteredMessages.length > 0 ? (
                            filteredMessages.map(msg => (
                                <Card key={msg._id.toString()}>
                                    <ZoruCardHeader className="flex flex-row justify-between items-start p-4">
                                        <div>
                                            <ZoruCardTitle className="text-base flex items-center gap-2">
                                                {msg.isFavourite && <Star className="h-5 w-5 text-amber-400 fill-amber-400" />}
                                                {msg.name}
                                            </ZoruCardTitle>
                                            <ZoruCardDescription>
                                                <Badge variant="outline" className="capitalize mt-1">{msg.type}</Badge>
                                            </ZoruCardDescription>
                                        </div>
                                        <div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(msg)}><Edit className="h-4 w-4"/></Button>
                                            <ZoruAlertDialog>
                                                <ZoruAlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                </ZoruAlertDialogTrigger>
                                                <ZoruAlertDialogContent>
                                                    <ZoruAlertDialogHeader><ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle><ZoruAlertDialogDescription>This will permanently delete the "{msg.name}" canned message.</ZoruAlertDialogDescription></ZoruAlertDialogHeader>
                                                    <ZoruAlertDialogFooter><ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel><ZoruAlertDialogAction onClick={() => handleDelete(msg._id.toString())} disabled={isDeleting}>{isDeleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null} Delete</ZoruAlertDialogAction></ZoruAlertDialogFooter>
                                                </ZoruAlertDialogContent>
                                            </ZoruAlertDialog>
                                        </div>
                                    </ZoruCardHeader>
                                    <ZoruCardContent className="p-4 pt-0">
                                        <p className="text-sm text-muted-foreground truncate">{msg.content.text || msg.content.mediaUrl}</p>
                                    </ZoruCardContent>
                                    <ZoruCardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                                        Created by: {msg.createdBy}
                                    </ZoruCardFooter>
                                </Card>
                            ))
                        ) : (
                            <div className="h-24 text-center flex items-center justify-center">
                                No canned messages found.
                            </div>
                        )}
                    </div>
                </ZoruCardContent>
            </Card>
        </>
    );
}
