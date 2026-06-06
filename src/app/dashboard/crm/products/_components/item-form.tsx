'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Card, useToast, Alert, AlertTitle, AlertDescription } from '@/components/sabcrm/20ui';
import { saveCrmProduct, getCrmProductById } from '@/app/actions/crm-products.actions';
import { AlertCircle } from 'lucide-react';

export function ItemForm({ initial }: { initial?: any }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lockingError, setLockingError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLockingError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    // Optimistic locking check
    if (initial?._id) {
      const current = await getCrmProductById(initial._id);
      if (current && new Date(current.updatedAt).getTime() > new Date(initial.updatedAt).getTime()) {
        setLockingError('This product was modified by another user while you were editing. Please refresh to see the latest changes.');
        setIsSubmitting(false);
        return;
      }
    }

    const res = await saveCrmProduct({}, formData);
    setIsSubmitting(false);

    if (res.error) {
      toast({ title: 'Error saving product', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Product saved successfully' });
      router.push('/dashboard/crm/products');
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      {lockingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Concurrent Edit Detected</AlertTitle>
          <AlertDescription>{lockingError}</AlertDescription>
        </Alert>
      )}
      
      {initial?._id && <input type="hidden" name="productId" value={initial._id} />}
      
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg">Basic Details</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input name="name" required defaultValue={initial?.name} />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input name="sku" defaultValue={initial?.sku} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Input name="description" defaultValue={initial?.description} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg">Pricing & Stock</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Selling Price</Label>
            <Input type="number" step="0.01" name="sellingPrice" defaultValue={initial?.sellingPrice} />
          </div>
          <div className="space-y-2">
            <Label>Cost Price</Label>
            <Input type="number" step="0.01" name="costPrice" defaultValue={initial?.costPrice} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isTrackInventory" defaultChecked={initial?.isTrackInventory} />
            <span className="text-sm font-medium">Track Inventory</span>
          </label>
          <div className="space-y-2">
            <Label>Reorder Point</Label>
            {/* Fix mismatched reorder points: make sure it binds to the correct property */}
            <Input 
                type="number" 
                name="reorderPoint" 
                defaultValue={initial?.inventory?.[0]?.reorderPoint ?? initial?.reorderPoint ?? 0} 
            />
          </div>
        </div>
        
        {/* Update stock directly from edit view */}
        <div className="space-y-2">
          <Label>Current Stock (Update Directly)</Label>
          <Input type="number" name="stockInHand" defaultValue={initial?.totalStock ?? 0} />
        </div>
      </Card>

      <Card className="p-6 space-y-4 bg-[var(--st-bg-secondary)]/50 border-dashed">
        <h3 className="font-semibold text-lg">Supplier Information</h3>
        <p className="text-sm text-[var(--st-text-secondary)]">Manage supplier details for this product.</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Supplier Name</Label>
            <Input name="supplierName" defaultValue={initial?.supplierName} placeholder="Acme Corp" />
          </div>
          <div className="space-y-2">
            <Label>Supplier Contact</Label>
            <Input name="supplierContact" defaultValue={initial?.supplierContact} placeholder="contact@acme.com" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Lead Time (Days)</Label>
          <Input type="number" name="supplierLeadTime" defaultValue={initial?.supplierLeadTime} />
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Product'}
        </Button>
      </div>
    </form>
  );
}
