'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCrmProduct } from "@/app/actions/crm-products.actions";
import { EntityFormField } from "@/components/crm/entity-form-field";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Upload, X } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { SabFilePickerButton } from "@/components/sabfiles";

interface ProductFormProps {
    initialData?: any; // To be typed strictly later
}

export function ProductForm({ initialData }: ProductFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // State management for controlled inputs (entity references handled by EntityFormField hidden inputs).
    const [isTrackInventory, setIsTrackInventory] = React.useState(initialData?.isTrackInventory || false);
    const [imageUrl, setImageUrl] = React.useState<string>(initialData?.images?.[0] || '');
    const [imageName, setImageName] = React.useState<string>('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        if (imageUrl) formData.set('imageUrl', imageUrl);
        // Drop the (now unused) imageFile entry — server prefers imageUrl.
        formData.delete('imageFile');
        // Checkbox handling (if unchecked, formData doesn't send it, so manual append if checked, or rely on 'on' check in server)
        // My server action checks `=== 'on'`, so default checkbox behavior is fine if named correctly.

        try {
            const result = await saveCrmProduct(null, formData);
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
                router.push('/dashboard/crm/inventory/items');
            }
        } catch (error) {
            toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 pb-10">
            <input type="hidden" name="productId" value={initialData?._id || ''} />

            <div className="flex items-center gap-4">
                <Link href="/dashboard/crm/inventory/items">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h2 className="text-xl font-semibold">
                        {initialData ? `Edit Product: ${initialData.name}` : "Product Details"}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Product
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Basic Info & Inventory */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Product Name *</Label>
                                <Input id="name" name="name" defaultValue={initialData?.name} required placeholder="e.g. Wireless Mouse" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="sku">SKU *</Label>
                                    <Input id="sku" name="sku" defaultValue={initialData?.sku} required placeholder="e.g. WM-001" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Item Type</Label>
                                    <div className="flex items-center gap-4 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="itemType" value="goods" defaultChecked={!initialData || initialData.itemType === 'goods'} />
                                            <span>Goods</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="itemType" value="service" defaultChecked={initialData?.itemType === 'service'} />
                                            <span>Service</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" name="description" defaultValue={initialData?.description} placeholder="Product description..." />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pricing</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="sellingPrice">Selling Price *</Label>
                                <Input type="number" step="0.01" id="sellingPrice" name="sellingPrice" defaultValue={initialData?.sellingPrice} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="costPrice">Cost Price</Label>
                                <Input type="number" step="0.01" id="costPrice" name="costPrice" defaultValue={initialData?.costPrice} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                                <Input type="number" step="0.1" id="taxRate" name="taxRate" defaultValue={initialData?.taxRate} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="hsnSac">HSN/SAC Code</Label>
                                <Input id="hsnSac" name="hsnSac" defaultValue={initialData?.hsnSac} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Inventory Tracking</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="isTrackInventory"
                                    name="isTrackInventory"
                                    checked={isTrackInventory}
                                    onCheckedChange={(checked) => setIsTrackInventory(checked as boolean)}
                                />
                                <Label htmlFor="isTrackInventory" className="cursor-pointer">Track Inventory for this item</Label>
                            </div>

                            {isTrackInventory && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="stockInHand">Opening Stock</Label>
                                        <Input
                                            type="number"
                                            id="stockInHand"
                                            name="stockInHand"
                                            defaultValue={initialData?.totalStock || 0}
                                            disabled={!!initialData} // Disable opening stock edit if already created? Or allow adjustment? Usually stock adjustment is better.
                                        // But for simplicity allow edit or just display.
                                        />
                                        {initialData && <p className="text-xs text-muted-foreground">To adjust stock, use Stock Adjustments.</p>}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="reorderPoint">Reorder Point</Label>
                                        <Input type="number" id="reorderPoint" name="reorderPoint" defaultValue={initialData?.inventory?.[0]?.reorderPoint || 0} />
                                    </div>
                                    <div className="grid gap-2 col-span-2">
                                        <Label htmlFor="batchTracking">Batch Tracking</Label>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="batchTracking" name="batchTracking" defaultChecked={initialData?.batchTracking} />
                                            <span className="text-sm text-muted-foreground">Enable Batch / Lot tracking</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Classification & Image */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Organization</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Category</Label>
                                <EntityFormField
                                    entity="category"
                                    name="categoryId"
                                    initialId={initialData?.categoryId || null}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Brand</Label>
                                <EntityFormField
                                    entity="brand"
                                    name="brandId"
                                    initialId={initialData?.brandId || null}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Unit & Dimensions</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Unit of Measure</Label>
                                <EntityFormField
                                    entity="unit"
                                    name="unitId"
                                    initialId={initialData?.unitId || null}
                                />
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-2">
                                <div className="grid gap-1">
                                    <Label className="text-xs">Length (cm)</Label>
                                    <Input type="number" name="length" defaultValue={initialData?.dimensions?.length} className="h-8" />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs">Breadth (cm)</Label>
                                    <Input type="number" name="breadth" defaultValue={initialData?.dimensions?.breadth} className="h-8" />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs">Height (cm)</Label>
                                    <Input type="number" name="height" defaultValue={initialData?.dimensions?.height} className="h-8" />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs">Weight (kg)</Label>
                                    <Input type="number" name="grossWeight" defaultValue={initialData?.weight?.gross} className="h-8" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Image</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2">
                                <Label>Product Image</Label>
                                <div className="flex items-center gap-2">
                                    <SabFilePickerButton
                                        accept="image"
                                        title="Pick product image"
                                        onPick={({ url, name }) => {
                                            setImageUrl(url);
                                            setImageName(name);
                                        }}
                                    >
                                        <Upload className="h-4 w-4" /> {imageUrl ? 'Replace image' : 'Choose image'}
                                    </SabFilePickerButton>
                                    {imageUrl && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Remove image"
                                            onClick={() => {
                                                setImageUrl('');
                                                setImageName('');
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                {imageUrl && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                        <a href={imageUrl} target="_blank" rel="noreferrer" className="underline truncate max-w-[260px]">
                                            {imageName || 'View image'}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
