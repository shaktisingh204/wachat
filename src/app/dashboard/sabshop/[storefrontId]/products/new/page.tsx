"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, Plus, Trash2, HelpCircle } from "lucide-react";
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Button,
  Input,
  Textarea,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  Separator,
  Badge,
} from "@/components/sabcrm/20ui/zoru";

export default function NewProductPage() {
  const params = useParams();
  const router = useRouter();
  const storefrontId = params.storefrontId as string;
  const [hasVariants, setHasVariants] = useState(false);

  return (
    <div className="flex-1 space-y-6 p-8 w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)] mb-4 hover:text-[var(--st-text)] transition-colors cursor-pointer w-fit" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </div>
      
      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Add Product</ZoruPageTitle>
          <ZoruPageDescription>
            Create a new product listing.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" className="mr-2" onClick={() => router.back()}>
            Discard
          </Button>
          <Button>
            Save Product
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Short Sleeve T-Shirt" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  placeholder="Describe your product in detail..." 
                  className="min-h-[150px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Add images, videos, or 3D models.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-[var(--st-border)] rounded-xl p-10 flex flex-col items-center justify-center text-center bg-[var(--st-bg-secondary)]/50 hover:bg-[var(--st-bg-secondary)] transition-colors cursor-pointer">
                <div className="w-12 h-12 bg-[var(--st-bg-muted)] rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-[var(--st-text-tertiary)]" />
                </div>
                <h3 className="text-sm font-medium text-[var(--st-text)] mb-1">Click to upload or drag and drop</h3>
                <p className="text-xs text-[var(--st-text-secondary)] max-w-[200px]">
                  SVG, PNG, JPG or GIF (max. 800x400px)
                </p>
                <Button variant="secondary" size="sm" className="mt-6">
                  Select Files
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-text-tertiary)]">$</span>
                    <Input id="price" type="number" placeholder="0.00" className="pl-7" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compare-price">Compare at price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--st-text-tertiary)]">$</span>
                    <Input id="compare-price" type="number" placeholder="0.00" className="pl-7" />
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-[var(--st-border)]">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Charge tax on this product</Label>
                    <p className="text-xs text-[var(--st-text-secondary)]">Applies to the base price.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Variants</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setHasVariants(!hasVariants)}>
                  {hasVariants ? "Cancel" : <><Plus className="w-4 h-4 mr-2" /> Add options like size or color</>}
                </Button>
              </div>
            </CardHeader>
            {hasVariants && (
              <CardContent className="space-y-6">
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-end gap-4">
                    <div className="space-y-2 flex-1">
                      <Label>Option name</Label>
                      <Select defaultValue="size">
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="size">Size</SelectItem>
                          <SelectItem value="color">Color</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="style">Style</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex-[2]">
                      <Label>Option values</Label>
                      <Input placeholder="Small, Medium, Large" />
                    </div>
                    <Button variant="ghost" size="icon" className="mb-0.5 text-[var(--st-text-secondary)] hover:text-[var(--st-danger)]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-dashed">
                    <Plus className="w-4 h-4 mr-2" />
                    Add another option
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select defaultValue="draft">
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="w-2 h-2 rounded-full p-0 flex-shrink-0" />
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="draft">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="w-2 h-2 rounded-full p-0 flex-shrink-0" />
                      Draft
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--st-text-secondary)] leading-relaxed">
                This product will be hidden from all sales channels.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product type</Label>
                <Input placeholder="e.g. T-Shirt" />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input placeholder="e.g. Nike" />
              </div>
              <div className="space-y-2">
                <Label>Collections</Label>
                <Input placeholder="Search collections..." />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input placeholder="Find or create tags" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>SKU (Stock Keeping Unit)</Label>
                <Input placeholder="e.g. TSHIRT-001" />
              </div>
              <div className="space-y-2">
                <Label>Barcode (ISBN, UPC, GTIN, etc.)</Label>
                <Input placeholder="e.g. 123456789012" />
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--st-border)] space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Track quantity</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Quantity Available</Label>
                  <Input type="number" defaultValue="0" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
