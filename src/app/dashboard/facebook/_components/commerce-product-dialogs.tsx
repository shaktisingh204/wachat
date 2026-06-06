"use client";

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertTitle, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  Pencil,
  PlusCircle,
  UploadCloud,
  } from "lucide-react";

import {
  addProductToCatalog,
  deleteProductFromCatalog,
  getTaggedMediaForProduct,
  updateProductInCatalog,
  bulkAddProductsToCatalog,
  } from "@/app/actions/catalog.actions";

/**
 * Commerce › Product dialogs (zoru-only).
 *
 * Local replacements for the legacy clay/wabasimplify dialogs:
 *   - CreateProductDialog        (addProductToCatalog)
 *   - EditProductDialog          (updateProductInCatalog)
 *   - DeleteProductConfirmDialog (deleteProductFromCatalog)
 *   - ViewTaggedMediaDialog      (getTaggedMediaForProduct)
 *   - BulkUploadProductsDialog   (bulkAddProductsToCatalog)
 *
 * Pure ZoruUI primitives, useToast, lucide-react.
 */

import * as React from "react";

import { SabFileUrlInput } from "@/components/sabfiles";

/* ------------------------------------------------------------------ */
/* Create product                                                     */
/* ------------------------------------------------------------------ */

const createInitialState: { message: string | null; error: string | null } = {
  message: null,
  error: null,
};

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
      {pending ? "Adding…" : "Add product"}
    </Button>
  );
}

export interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  projectId: string;
  onCreated?: () => void;
}

export function CreateProductDialog({
  open,
  onOpenChange,
  catalogId,
  projectId,
  onCreated,
}: CreateProductDialogProps) {
  const [state, formAction] = useActionState(
    addProductToCatalog,
    createInitialState as any,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (state?.message) {
      toast({
        title: "Product added",
        description: state.message,
        variant: "success",
      });
      formRef.current?.reset();
      setImageUrl("");
      onOpenChange(false);
      onCreated?.();
    }
  }, [state, toast, onOpenChange, onCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Add new product</DialogTitle>
            <DialogDescription>
              Push a product to your Meta catalog. Fields map directly to
              Commerce Manager.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="catalogId" value={catalogId} />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cp-name">Product name</Label>
              <Input id="cp-name" name="name" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cp-retailer">SKU / Retailer ID</Label>
              <Input id="cp-retailer" name="retailer_id" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-price">Price</Label>
                <Input
                  id="cp-price"
                  name="price"
                  type="number"
                  step="0.01"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cp-currency">Currency</Label>
                <Select name="currency" defaultValue="USD">
                  <SelectTrigger id="cp-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cp-desc">Description</Label>
              <Textarea id="cp-desc" name="description" rows={3} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cp-image">Image URL</Label>
              <SabFileUrlInput
                id="cp-image"
                name="image_url"
                accept="image"
                value={imageUrl}
                onChange={setImageUrl}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <CreateSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Edit product                                                       */
/* ------------------------------------------------------------------ */

const editInitialState: { message: string | null; error: string | null; success?: boolean } = {
  message: null,
  error: null,
};

function EditSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Pencil />}
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

export interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  projectId: string;
  onUpdated?: () => void;
}

export function EditProductDialog({
  open,
  onOpenChange,
  product,
  projectId,
  onUpdated,
}: EditProductDialogProps) {
  const [state, formAction] = useActionState(
    updateProductInCatalog,
    editInitialState as any,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string>("");

  useEffect(() => {
    setImageUrl((product?.image_url as string | undefined) ?? "");
  }, [product]);

  useEffect(() => {
    if (state?.success && state?.message) {
      toast({
        title: "Product updated",
        description: state.message,
        variant: "success",
      });
      onOpenChange(false);
      onUpdated?.();
    }
  }, [state, toast, onOpenChange, onUpdated]);

  if (!product) return null;

  // Meta returns price as cents — show as a decimal in the input.
  const priceDecimal =
    typeof product.price === "number" || typeof product.price === "string"
      ? (Number(product.price) / 100).toFixed(2)
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update the catalog entry. Changes sync to Meta on save.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="productId" value={product.id} />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ep-name">Product name</Label>
              <Input
                id="ep-name"
                name="name"
                defaultValue={product.name ?? ""}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ep-price">Price</Label>
                <Input
                  id="ep-price"
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={priceDecimal}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ep-currency">Currency</Label>
                <Select
                  name="currency"
                  defaultValue={product.currency ?? "USD"}
                >
                  <SelectTrigger id="ep-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-desc">Description</Label>
              <Textarea
                id="ep-desc"
                name="description"
                rows={3}
                defaultValue={product.description ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-image">Image URL</Label>
              <SabFileUrlInput
                id="ep-image"
                name="image_url"
                accept="image"
                value={imageUrl}
                onChange={setImageUrl}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <EditSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Delete product confirm                                             */
/* ------------------------------------------------------------------ */

export interface DeleteProductConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name?: string } | null;
  projectId: string;
  onDeleted?: () => void;
}

export function DeleteProductConfirmDialog({
  open,
  onOpenChange,
  product,
  projectId,
  onDeleted,
}: DeleteProductConfirmDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!product) return;
    startTransition(async () => {
      const result = await deleteProductFromCatalog(product.id, projectId);
      if (result.success) {
        toast({
          title: "Product deleted",
          description: "The product was removed from your Meta catalog.",
          variant: "success",
        });
        onOpenChange(false);
        onDeleted?.();
      } else {
        toast({
          title: "Could not delete product",
          description: result.error ?? "Unknown error",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this product?</AlertDialogTitle>
          <AlertDialogDescription>
            {product?.name
              ? `This will permanently delete “${product.name}” from your Meta catalog. This action cannot be undone.`
              : "This will permanently delete the selected product from your Meta catalog. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* View tagged media                                                  */
/* ------------------------------------------------------------------ */

export interface ViewTaggedMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name?: string } | null;
  projectId: string;
}

export function ViewTaggedMediaDialog({
  open,
  onOpenChange,
  product,
  projectId,
}: ViewTaggedMediaDialogProps) {
  const [media, setMedia] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    if (open && product?.id) {
      setError(null);
      setMedia([]);
      startLoading(async () => {
        const result = await getTaggedMediaForProduct(product.id, projectId);
        if ((result as { error?: string })?.error) {
          setError((result as { error?: string }).error ?? "Unknown error");
        } else {
          setMedia(((result as any).media as any[]) ?? []);
        }
      });
    }
  }, [open, product?.id, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Tagged media{product?.name ? ` — ${product.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Posts and other media where this product has been tagged.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-2 max-h-[60vh] overflow-y-auto p-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load media</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : media.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <Link
                  key={item.id}
                  href={item.permalink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-[var(--st-radius-sm)] border border-[var(--st-border)]"
                >
                  <Image
                    src={
                      item.image_url ||
                      item.thumbnail_url ||
                      "https://placehold.co/400x400.png"
                    }
                    alt="Tagged media"
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--st-text)]/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="p-1 text-center text-xs text-[var(--st-bg)]">
                      View post
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--st-radius-sm)] border border-dashed border-[var(--st-border)] py-16 text-center text-[var(--st-text-secondary)]">
              <ImageIcon className="mx-auto h-10 w-10" />
              <h3 className="mt-3 text-sm font-medium text-[var(--st-text)]">
                No tagged media yet
              </h3>
              <p className="mt-1 text-xs">
                This product has not been tagged in any posts yet.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Bulk upload products                                               */
/* ------------------------------------------------------------------ */

export interface BulkUploadProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  projectId: string;
  onUploaded?: () => void;
}

export function BulkUploadProductsDialog({
  open,
  onOpenChange,
  catalogId,
  projectId,
  onUploaded,
}: BulkUploadProductsDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = () => {
    if (!file) return;
    startTransition(async () => {
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
          toast({ title: "Invalid CSV", description: "CSV must have a header row and at least one data row.", variant: "destructive" });
          return;
        }
        
        const splitLine = (l: string) => {
          const matches = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          return matches ? matches.map(m => m.replace(/^"|"$/g, '').trim()) : [];
        };
        
        const headers = splitLine(lines[0].toLowerCase());
        const rows = lines.slice(1).map(l => {
          const cols = splitLine(l);
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            if (cols[i]) obj[h] = cols[i];
          });
          return obj;
        });

        const result = await bulkAddProductsToCatalog(projectId, catalogId, rows);
        
        if (result.failCount > 0) {
          toast({
            title: `Bulk upload finished with errors`,
            description: `Successfully added ${result.successCount} products, but ${result.failCount} failed.`,
            variant: "warning",
          });
          console.error("Bulk upload errors:", result.errors);
        } else {
          toast({
            title: "Bulk upload complete",
            description: `Successfully added ${result.successCount} products.`,
            variant: "success",
          });
        }
        onOpenChange(false);
        onUploaded?.();
      } catch (err: any) {
         toast({
            title: "Error parsing CSV",
            description: err.message,
            variant: "destructive",
          });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) setFile(null);
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk upload via CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple products to this catalog at once.
            Ensure headers match: <code>id</code>, <code>title</code>, <code>description</code>, <code>price</code>, <code>currency</code>, <code>image_link</code>, <code>link</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="csvFile">CSV File</Label>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="text-xs text-[var(--st-text-secondary)]">Selected: {file.name}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file || isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
