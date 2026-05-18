

'use client';

import { useState } from 'react';
import { ZoruButton, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { Home, Plus, Trash2, Check, Settings, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WithId, WebsitePage, EcommPage } from '@/lib/definitions';
import {
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuSeparator,
    ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruAlertDialogTrigger,
} from '@/components/zoruui';
import { deleteWebsitePage, setAsHomepage, saveWebsitePage } from '@/app/actions/portfolio.actions';
import { useToast } from '@/hooks/use-toast';

interface PageManagerPanelProps {
    pages: WithId<WebsitePage | EcommPage>[];
    activePageId: string | null;
    shopId: string;
    onSelectPage: (pageId: string) => void;
    onPagesUpdate: () => void;
}

export function PageManagerPanel({ pages, activePageId, shopId, onSelectPage, onPagesUpdate }: PageManagerPanelProps) {
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [newPageName, setNewPageName] = useState('');

    const handleCreatePage = async () => {
        if (!newPageName.trim()) return;

        const slug = newPageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const result = await saveWebsitePage({
            siteId: shopId,
            name: newPageName,
            slug: slug,
            layout: [],
        });

        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'New page created.' });
            onPagesUpdate();
            if (result.pageId) {
                onSelectPage(result.pageId);
            }
        }
        setNewPageName('');
        setIsCreating(false);
    }

    const handleDeletePage = async (pageId: string) => {
        const result = await deleteWebsitePage(pageId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Page deleted.' });
            onPagesUpdate();
        }
    }

    const handleSetHomepage = async (pageId: string) => {
        const result = await setAsHomepage(pageId, shopId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Homepage updated.' });
            onPagesUpdate();
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Pages</h2>
                <ZoruButton variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsCreating(true)}>
                    <Plus className="h-4 w-4" />
                </ZoruButton>
            </div>
            {isCreating && (
                <div className="space-y-2 p-2 border rounded-md">
                    <ZoruInput
                        placeholder="New page name..."
                        value={newPageName}
                        onChange={(e) => setNewPageName(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <ZoruButton variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Cancel</ZoruButton>
                        <ZoruButton size="sm" onClick={handleCreatePage}>Create</ZoruButton>
                    </div>
                </div>
            )}
            <div className="space-y-1">
                {pages.map(page => (
                    <div key={page._id.toString()} className={cn("flex items-center group rounded-md transaction-all duration-200", activePageId === page._id.toString() ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50')}>
                        <ZoruButton variant="ghost" className="flex-1 justify-start font-normal" onClick={() => onSelectPage(page._id.toString())}>
                            {page.isHomepage && <Home className="mr-2 h-4 w-4 text-primary" />}
                            <span className="truncate">{page.name}</span>
                        </ZoruButton>
                        <ZoruDropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <ZoruButton variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                    <MoreVertical className="h-4 w-4" />
                                </ZoruButton>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent>
                                <ZoruDropdownMenuItem onSelect={() => handleSetHomepage(page._id.toString())}>Set as Homepage</ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem disabled>Settings</ZoruDropdownMenuItem>
                                <ZoruDropdownMenuSeparator />
                                <ZoruAlertDialog>
                                    <ZoruAlertDialogTrigger asChild>
                                        <ZoruDropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10">Delete</ZoruDropdownMenuItem>
                                    </ZoruAlertDialogTrigger>
                                    <ZoruAlertDialogContent>
                                        <ZoruAlertDialogHeader><ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle><ZoruAlertDialogDescription>This will permanently delete the page "{page.name}". This action cannot be undone.</ZoruAlertDialogDescription></ZoruAlertDialogHeader>
                                        <ZoruAlertDialogFooter><ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel><ZoruAlertDialogAction onClick={() => handleDeletePage(page._id.toString())}>Delete</ZoruAlertDialogAction></ZoruAlertDialogFooter>
                                    </ZoruAlertDialogContent>
                                </ZoruAlertDialog>
                            </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                    </div>
                ))}
            </div>
        </div>
    );
}
