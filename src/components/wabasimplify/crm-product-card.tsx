
'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ShoppingBag } from 'lucide-react';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { deleteCrmProduct } from '@/app/actions/crm-products.actions';

interface CrmProductCardProps {
    product: WithId<EcommProduct>;
    currency: string;
    onEdit: () => void;
    onDelete: () => void;
}

export function CrmProductCard({ product, currency, onEdit, onDelete }: CrmProductCardProps) {
    const { toast } = useToast();

    const handleDelete = async () => {
        const result = await deleteCrmProduct(product._id.toString());
        if (result.success) {
            toast({ title: 'Success', description: 'Product deleted.' });
            onDelete();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    return (
        <Card className="flex flex-col">
            <div className="group block flex-grow flex flex-col">
                <CardHeader className="p-0">
                    <div className="relative aspect-[4/5] bg-muted">
                        <Image src={product.imageUrl || 'https://placehold.co/400x500.png'} alt={product.name} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint="product photo" />
                    </div>
                     <div className="p-4">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">{product.description}</p>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-lg font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(product.price)}</p>
                        <Badge variant={product.stock && product.stock > 0 ? 'default' : 'destructive'}>
                            {product.stock && product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </Badge>
                    </div>
                </CardContent>
            </div>
            <CardFooter className="p-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onEdit}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{product.name}".</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    );
}
