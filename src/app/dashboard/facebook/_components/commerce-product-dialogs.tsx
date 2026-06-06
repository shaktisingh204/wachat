"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
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
 * Pure ZoruUI primitives, useZoruToast, lucide-react.
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
  const { toast } = useZoruToast();
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
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add new product</ZoruDialogTitle>
            <ZoruDialogDescription>
              Push a product to your Meta catalog. Fields map directly to
              Commerce Manager.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="catalogId" value={catalogId} />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
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
                  <ZoruSelectTrigger id="cp-currency">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="USD">USD</ZoruSelectItem>
                    <ZoruSelectItem value="EUR">EUR</ZoruSelectItem>
                    <ZoruSelectItem value="INR">INR</ZoruSelectItem>
                    <ZoruSelectItem value="GBP">GBP</ZoruSelectItem>
                  </ZoruSelectContent>
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

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <CreateSubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
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
  const { toast } = useZoruToast();
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
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit product</ZoruDialogTitle>
            <ZoruDialogDescription>
              Update the catalog entry. Changes sync to Meta on save.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="productId" value={product.id} />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
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
                  <ZoruSelectTrigger id="ep-currency">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="USD">USD</ZoruSelectItem>
                    <ZoruSelectItem value="EUR">EUR</ZoruSelectItem>
                    <ZoruSelectItem value="INR">INR</ZoruSelectItem>
                    <ZoruSelectItem value="GBP">GBP</ZoruSelectItem>
                  </ZoruSelectContent>
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

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <EditSubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
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
  const { toast } = useZoruToast();

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
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete this product?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            {product?.name
              ? `This will permanently delete “${product.name}” from your Meta catalog. This action cannot be undone.`
              : "This will permanently delete the selected product from your Meta catalog. This action cannot be undone."}
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={isPending}>
            Cancel
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
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
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
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
      <ZoruDialogContent className="sm:max-w-3xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            Tagged media{product?.name ? ` — ${product.name}` : ""}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Posts and other media where this product has been tagged.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
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
              <ZoruAlertTitle>Could not load media</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          ) : media.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <Link
                  key={item.id}
                  href={item.permalink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-[var(--zoru-radius-sm)] border border-[var(--st-border)]"
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
            <div className="rounded-[var(--zoru-radius-sm)] border border-dashed border-[var(--st-border)] py-16 text-center text-[var(--st-text-secondary)]">
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
      </ZoruDialogContent>
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
  const { toast } = useZoruToast();
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
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Bulk upload via CSV</ZoruDialogTitle>
          <ZoruDialogDescription>
            Upload a CSV file to add multiple products to this catalog at once.
            Ensure headers match: <code>id</code>, <code>title</code>, <code>description</code>, <code>price</code>, <code>currency</code>, <code>image_link</code>, <code>link</code>.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

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

        <ZoruDialogFooter>
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
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
