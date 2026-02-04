'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCrmWarehouse } from "@/app/actions/crm-warehouses.actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface WarehouseFormProps {
    initialData?: any;
}

export function WarehouseForm({ initialData }: WarehouseFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            const result = await saveCrmWarehouse(null, formData);
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
                router.push('/dashboard/crm/inventory/warehouses');
            }
        } catch (error) {
            toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
            <input type="hidden" name="warehouseId" value={initialData?._id || ''} />

            <div className="flex items-center gap-4">
                <Link href="/dashboard/crm/inventory/warehouses">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    {/* Header handled by page wrapper mostly, but good for context */}
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Warehouse
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Warehouse Name *</Label>
                        <Input id="name" name="name" defaultValue={initialData?.name} required placeholder="e.g. Main Warehouse" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="location">Address / Location</Label>
                        <Input id="location" name="location" defaultValue={initialData?.address || initialData?.location} placeholder="e.g. 123 Storage Lane" />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="isDefault" name="isDefault" defaultChecked={initialData?.isDefault} />
                        <Label htmlFor="isDefault" className="cursor-pointer">
                            Set as Default Warehouse
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                        Default warehouse is used for initial stock assignments and quick actions.
                    </p>
                </CardContent>
            </Card>
        </form>
    );
}
