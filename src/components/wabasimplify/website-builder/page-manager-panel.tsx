
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, Plus, Trash2, Check, Settings, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WithId, EcommPage } from '@/lib/definitions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { deleteEcommPage, setAsHomepage, saveEcommPage } from '@/app/actions/custom-ecommerce.actions';
import { useToast } from '@/hooks/use-toast';

interface PageManagerPanelProps {
  pages: WithId<EcommPage>[];
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
        
        const result = await saveEcommPage({
            shopId: shopId,
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
        const result = await deleteEcommPage(pageId);
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
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsCreating(true)}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
             {isCreating && (
                <div className="space-y-2 p-2 border rounded-md">
                    <Input
                        placeholder="New page name..."
                        value={newPageName}
                        onChange={(e) => setNewPageName(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleCreatePage}>Create</Button>
                    </div>
                </div>
            )}
            <div className="space-y-1">
                {pages.map(page => (
                    <div key={page._id.toString()} className={cn("flex items-center group rounded-md", activePageId === page._id.toString() && 'bg-muted')}>
                        <Button variant="ghost" className="flex-1 justify-start font-normal" onClick={() => onSelectPage(page._id.toString())}>
                             {page.isHomepage && <Home className="mr-2 h-4 w-4 text-primary" />}
                            <span className="truncate">{page.name}</span>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                    <MoreVertical className="h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleSetHomepage(page._id.toString())}>Set as Homepage</DropdownMenuItem>
                                <DropdownMenuItem disabled>Settings</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10">Delete</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the page "{page.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePage(page._id.toString())}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </div>
        </div>
    );
}
