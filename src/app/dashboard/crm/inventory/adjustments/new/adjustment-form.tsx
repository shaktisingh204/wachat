'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCrmStockAdjustment } from "@/app/actions/crm-inventory.actions";
import { SmartProductSelect } from "@/components/crm/inventory/smart-product-select";
import { SmartWarehouseSelect } from "@/components/crm/inventory/smart-warehouse-select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function AdjustmentForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const [productId, setProductId] = React.useState('');
    const [warehouseId, setWarehouseId] = React.useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        if (productId) formData.set('productId', productId);
        if (warehouseId) formData.set('warehouseId', warehouseId);

        try {
            const result = await saveCrmStockAdjustment(null, formData);
            if (result.error) {
                toast({
                    title: "Error",
                    description: result.error,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Success",
                    description: result.message,
                });
                router.push('/dashboard/crm/inventory/adjustments');
            }
        } catch (error) {
            toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/crm/inventory/adjustments">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    {/* Header */}
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Adjustment
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Adjustment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Product *</Label>
                        <SmartProductSelect value={productId} onSelect={setProductId} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Warehouse *</Label>
                        <SmartWarehouseSelect value={warehouseId} onSelect={setWarehouseId} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="reason">Reason *</Label>
                        <Select name="reason" required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Stock Received">Stock Received</SelectItem>
                                <SelectItem value="Inventory Count">Inventory Count</SelectItem>
                                <SelectItem value="Goods In">Goods In</SelectItem>
                                <SelectItem value="Damage">Damage</SelectItem>
                                <SelectItem value="Theft/Loss">Theft/Loss</SelectItem>
                                <SelectItem value="Sale">Sale (Manual)</SelectItem>
                                <SelectItem value="Return">Return</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="quantity">Quantity Adjustment *</Label>
                        <Input
                            type="number"
                            id="quantity"
                            name="quantity"
                            required
                            placeholder="e.g. 10 (add) or -5 (remove)"
                        />
                        <p className="text-xs text-muted-foreground">
                            Use positive numbers to add stock, negative to remove.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" name="notes" placeholder="Optional notes..." />
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
