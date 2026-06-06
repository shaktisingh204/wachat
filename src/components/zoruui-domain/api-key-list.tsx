'use client';

import {
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Button,
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
} from '@/components/sabcrm/20ui/compat';
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
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={apiKey.revoked}>
                    <Trash2 className="mr-2 h-4 w-4"/>
                    Revoke
                </Button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                 <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                        This action will permanently revoke the API key "{apiKey.name}". Any applications using this key will no longer have access.
                    </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleRevoke} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Revoke Key
                    </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
        </ZoruAlertDialog>
    );
}

export function ApiKeyList({ keys, onKeyRevoked }: ApiKeyListProps) {
    if (keys.length === 0) {
        return <p className="text-zoru-ink-muted text-center py-8">No API keys created yet.</p>;
    }
    
    return (
        <div className="border rounded-md">
            <Table>
                <ZoruTableHeader>
                    <ZoruTableRow>
                        <ZoruTableHead>Name</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Created</ZoruTableHead>
                        <ZoruTableHead>Last Used</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {keys.map(key => (
                        <ZoruTableRow key={key._id.toString()}>
                            <ZoruTableCell className="font-medium">{key.name}</ZoruTableCell>
                            <ZoruTableCell>
                                {key.revoked ? <Badge variant="destructive">Revoked</Badge> : <Badge>Active</Badge>}
                            </ZoruTableCell>
                            <ZoruTableCell>{new Date(key.createdAt).toLocaleDateString()}</ZoruTableCell>
                             <ZoruTableCell>{key.lastUsed ? formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true }) : 'Never'}</ZoruTableCell>
                            <ZoruTableCell className="text-right">
                                <RevokeButton apiKey={key} onKeyRevoked={onKeyRevoked} />
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ))}
                </ZoruTableBody>
            </Table>
        </div>
    );
}
