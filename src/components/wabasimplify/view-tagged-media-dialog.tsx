
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getTaggedMediaForProduct } from '@/app/actions/catalog.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface ViewTaggedMediaDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  projectId: string;
}

export function ViewTaggedMediaDialog({ isOpen, onOpenChange, product, projectId }: ViewTaggedMediaDialogProps) {
  const [media, setMedia] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    if (isOpen) {
      startLoading(async () => {
        const result = await getTaggedMediaForProduct(product.id, projectId);
        if (result.error) {
          setError(result.error);
        } else {
          setMedia(result.media || []);
        }
      });
    }
  }, [isOpen, product.id, projectId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Media Tagged with "{product.name}"</DialogTitle>
          <DialogDescription>
            Posts and other media where this product has been tagged.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-1 -mx-2">
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
                </div>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : media.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                    {media.map(item => (
                        <Link key={item.id} href={item.permalink || '#'} target="_blank" rel="noopener noreferrer" className="block relative aspect-square group">
                            <Image src={item.image_url || item.thumbnail_url || 'https://placehold.co/400x400.png'} alt="Tagged media" layout="fill" objectFit="cover" className="rounded-md" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs text-center p-1">View Post</span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ImageIcon className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Tagged Media Found</h3>
                    <p className="mt-1 text-sm">This product has not been tagged in any posts yet.</p>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
