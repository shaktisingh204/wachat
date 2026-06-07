'use client';

import { Table, TBody, Td, Th, THead, Tr, Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Badge } from '@/components/sabcrm/20ui';
import {
  useState,
  useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { revokeApiKey } from '@/app/actions/api-keys.actions';
import type { ApiKey } from '@/lib/definitions';
import { LoaderCircle, Trash2 } from 'lucide-react';

import { formatDistanceToNow } from 'date-fns';

interface ApiKeyListProps {
  keys: Omit<ApiKey, 'key'>[];
  onKeyRevoked: () => void;
}

function RevokeButton({ apiKey, onKeyRevoked }: { apiKey: Omit<ApiKey, 'key'>, onKeyRevoked: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleRevoke = () => {
        startTransition(async () => {
            const result = await revokeApiKey(apiKey._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'API key has been revoked.' });
                onKeyRevoked();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={apiKey.revoked}>
                    <Trash2 className="mr-2 h-4 w-4"/>
                    Revoke
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                 <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will permanently revoke the API key "{apiKey.name}". Any applications using this key will no longer have access.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRevoke} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Revoke Key
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function ApiKeyList({ keys, onKeyRevoked }: ApiKeyListProps) {
    if (keys.length === 0) {
        return <p className="text-[var(--st-text-secondary)] text-center py-8">No API keys created yet.</p>;
    }
    
    return (
        <div className="border rounded-md">
            <Table>
                <THead>
                    <Tr>
                        <Th>Name</Th>
                        <Th>Status</Th>
                        <Th>Created</Th>
                        <Th>Last Used</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {keys.map(key => (
                        <Tr key={key._id.toString()}>
                            <Td className="font-medium">{key.name}</Td>
                            <Td>
                                {key.revoked ? <Badge variant="destructive">Revoked</Badge> : <Badge>Active</Badge>}
                            </Td>
                            <Td>{new Date(key.createdAt).toLocaleDateString()}</Td>
                             <Td>{key.lastUsed ? formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true }) : 'Never'}</Td>
                            <Td className="text-right">
                                <RevokeButton apiKey={key} onKeyRevoked={onKeyRevoked} />
                            </Td>
                        </Tr>
                    ))}
                </TBody>
            </Table>
        </div>
    );
}
