"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, Plus, Trash2, X, FileImage } from "lucide-react";
import {
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Card,
  CardBody,
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
  Dot,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";

export default function NewProductPage() {
  const params = useParams();
  const router = useRouter();
  const storefrontId = params.storefrontId as string;
  const { toast } = useToast();

  const [hasVariants, setHasVariants] = useState(false);
  const [media, setMedia] = useState<SabFilePick[]>([]);

  function handlePickMedia(pick: SabFilePick) {
    setMedia((prev) => [...prev, pick]);
    toast.success("Media added");
  }

  function handleRemoveMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    toast.success("Product saved");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        iconLeft={ArrowLeft}
        className="w-fit"
        onClick={() => router.back()}
      >
        Back to products
      </Button>

      <PageHeader bordered={false}>
        <PageHeading>
          <PageTitle>Add product</PageTitle>
          <PageDescription>Create a new product listing for your store.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => router.back()}>
            Discard
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save product
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Title">
                <Input placeholder="Short-sleeve cotton t-shirt" />
              </Field>
              <Field label="Description">
                <Textarea
                  placeholder="Describe the product, its materials, and fit"
                  rows={6}
                  className="min-h-[150px]"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Add images, videos, or 3D models.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="border-2 border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-10 flex flex-col items-center justify-center text-center bg-[var(--st-bg-secondary)]">
                <span
                  className="w-12 h-12 bg-[var(--st-bg-muted)] rounded-full flex items-center justify-center mb-4"
                  aria-hidden="true"
                >
                  <Upload className="w-6 h-6 text-[var(--st-text-tertiary)]" />
                </span>
                <h3 className="text-sm font-medium text-[var(--st-text)] mb-1">
                  Add media from your library or upload a new file
                </h3>
                <p className="text-xs text-[var(--st-text-secondary)] max-w-[220px]">
                  SVG, PNG, JPG, or GIF up to 800x400px.
                </p>
                <SabFilePickerButton
                  accept="image"
                  variant="outline"
                  className="mt-6"
                  onPick={handlePickMedia}
                >
                  <Upload /> Select files
                </SabFilePickerButton>
              </div>

              {media.length > 0 ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {media.map((file, index) => (
                    <li
                      key={`${file.url}-${index}`}
                      className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
                    >
                      <FileImage
                        className="w-4 h-4 shrink-0 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate text-xs text-[var(--st-text)]">
                        {file.name ?? "Untitled file"}
                      </span>
                      <IconButton
                        label={`Remove ${file.name ?? "file"}`}
                        icon={X}
                        size="sm"
                        onClick={() => handleRemoveMedia(index)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price">
                  <Input type="number" placeholder="0.00" prefix="₹" />
                </Field>
                <Field label="Compare-at price">
                  <Input type="number" placeholder="0.00" prefix="₹" />
                </Field>
              </div>
              <div className="mt-6 pt-6 border-t border-[var(--st-border)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-[var(--st-text)]">
                      Charge tax on this product
                    </p>
                    <p className="text-xs text-[var(--st-text-secondary)]">
                      Applies to the base price.
                    </p>
                  </div>
                  <Switch defaultChecked aria-label="Charge tax on this product" />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Variants</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={hasVariants ? undefined : Plus}
                  onClick={() => setHasVariants(!hasVariants)}
                >
                  {hasVariants ? "Cancel" : "Add options like size or colour"}
                </Button>
              </div>
            </CardHeader>
            {hasVariants ? (
              <CardBody className="space-y-6">
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-end gap-4">
                    <Field label="Option name" className="flex-1">
                      <Select defaultValue="size">
                        <SelectTrigger aria-label="Option name">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="size">Size</SelectItem>
                          <SelectItem value="color">Color</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="style">Style</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Option values" className="flex-[2]">
                      <Input placeholder="Small, Medium, Large" />
                    </Field>
                    <IconButton
                      label="Remove option"
                      icon={Trash2}
                      variant="ghost"
                      className="mb-0.5"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    iconLeft={Plus}
                    className="border-dashed"
                  >
                    Add another option
                  </Button>
                </div>
              </CardBody>
            ) : null}
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Product status">
                <Select defaultValue="draft">
                  <SelectTrigger aria-label="Product status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2">
                        <Dot tone="success" />
                        Active
                      </span>
                    </SelectItem>
                    <SelectItem value="draft">
                      <span className="flex items-center gap-2">
                        <Dot tone="neutral" />
                        Draft
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-xs text-[var(--st-text-secondary)] leading-relaxed">
                This product will be hidden from all sales channels.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Product type">
                <Input placeholder="e.g. T-shirt" />
              </Field>
              <Field label="Vendor">
                <Input placeholder="e.g. Northwind" />
              </Field>
              <Field label="Collections">
                <Input placeholder="Search collections" />
              </Field>
              <Field label="Tags">
                <Input placeholder="Find or create tags" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="SKU (stock keeping unit)">
                <Input placeholder="e.g. TSHIRT-001" />
              </Field>
              <Field label="Barcode (ISBN, UPC, GTIN)">
                <Input placeholder="e.g. 123456789012" />
              </Field>
              <div className="mt-4 space-y-4 border-t border-[var(--st-border)] pt-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-[var(--st-text)]">Track quantity</p>
                  <Switch defaultChecked aria-label="Track quantity" />
                </div>
                <Field label="Quantity available">
                  <Input type="number" defaultValue="0" />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Carries the route param so the surface is wired to its storefront. */}
      <input type="hidden" name="storefrontId" value={storefrontId} />
    </div>
  );
}
