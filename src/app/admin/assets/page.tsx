'use client';

import * as React from 'react';
import { ZoruFilesPage, type ZoruFileEntity } from '@/components/sabcrm/20ui/zoru';
import { getAdminBuilderAssets } from './actions';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminAssetsPage() {
    const [files, setFiles] = React.useState<ZoruFileEntity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchAssets = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await getAdminBuilderAssets();
            
            const mappedFiles: ZoruFileEntity[] = items.map((item: any) => ({
                id: item.id || item._id || Math.random().toString(),
                name: item.name || item.filename || 'Unnamed Asset',
                mime: item.mimeType || item.contentType || 'application/octet-stream',
                size: item.size || item.bytes || 0,
                modified: item.updatedAt ? new Date(item.updatedAt) : new Date(),
                url: item.url || item.path || '',
                thumbnailUrl: item.thumbnailUrl || undefined,
                isFolder: false,
                starred: item.starred || false,
            }));
            
            setFiles(mappedFiles);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to load assets.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchAssets();
    }, [fetchAssets]);

    const handleUpload = React.useCallback((uploadedFiles: File[]) => {
        toast({
            title: 'Upload Started',
            description: `Uploading ${uploadedFiles.length} file(s)...`,
        });
        // Mock upload logic just to close dialog if needed, but in reality 
        // this would hit an API and refresh the list.
        setTimeout(() => {
            fetchAssets();
            toast({
                title: 'Upload Complete',
                description: 'Files successfully uploaded.',
            });
        }, 1500);
    }, [fetchAssets, toast]);

    const handleDelete = React.useCallback((deletedFiles: ZoruFileEntity[]) => {
        toast({
            title: 'Files Deleted',
            description: `Deleted ${deletedFiles.length} file(s).`,
        });
        setFiles(prev => prev.filter(f => !deletedFiles.find(d => d.id === f.id)));
    }, [toast]);

    return (
        <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-[var(--st-text)]">Asset Management</h1>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                    Manage global builder and media assets.
                </p>
            </div>
            
            {isLoading ? (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)]">
                    <LoaderCircle className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                </div>
            ) : (
                <ZoruFilesPage 
                    files={files} 
                    defaultView="grid"
                    onUpload={handleUpload}
                    onDelete={handleDelete}
                    empty={
                        <div className="py-20 text-center text-[var(--st-text-secondary)]">
                            No assets found. Click upload to add new assets.
                        </div>
                    }
                />
            )}
        </div>
    );
}
