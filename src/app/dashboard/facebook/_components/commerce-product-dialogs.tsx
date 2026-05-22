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
} from '@/components/zoruui';
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
  } from "lucide-react";

import {
  addProductToCatalog,
  deleteProductFromCatalog,
  getTaggedMediaForProduct,
  updateProductInCatalog,
  } from "@/app/actions/catalog.actions";

/**
 * Commerce › Product dialogs (zoru-only).
 *
 * Local replacements for the legacy clay/wabasimplify dialogs:
 *   - CreateProductDialog        (addProductToCatalog)
 *   - EditProductDialog          (updateProductInCatalog)
 *   - DeleteProductConfirmDialog (deleteProductFromCatalog)
 *   - ViewTaggedMediaDialog      (getTaggedMediaForProduct)
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
      {pending ? "Adding…" : "Add product"}
    </ZoruButton>
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
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
            <ZoruAlert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="cp-name">Product name</ZoruLabel>
              <ZoruInput id="cp-name" name="name" required />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="cp-retailer">SKU / Retailer ID</ZoruLabel>
              <ZoruInput id="cp-retailer" name="retailer_id" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <ZoruLabel htmlFor="cp-price">Price</ZoruLabel>
                <ZoruInput
                  id="cp-price"
                  name="price"
                  type="number"
                  step="0.01"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <ZoruLabel htmlFor="cp-currency">Currency</ZoruLabel>
                <ZoruSelect name="currency" defaultValue="USD">
                  <ZoruSelectTrigger id="cp-currency">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="USD">USD</ZoruSelectItem>
                    <ZoruSelectItem value="EUR">EUR</ZoruSelectItem>
                    <ZoruSelectItem value="INR">INR</ZoruSelectItem>
                    <ZoruSelectItem value="GBP">GBP</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="cp-desc">Description</ZoruLabel>
              <ZoruTextarea id="cp-desc" name="description" rows={3} />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="cp-image">Image URL</ZoruLabel>
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
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <CreateSubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Pencil />}
      {pending ? "Saving…" : "Save changes"}
    </ZoruButton>
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
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
            <ZoruAlert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertDescription>{state.error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="ep-name">Product name</ZoruLabel>
              <ZoruInput
                id="ep-name"
                name="name"
                defaultValue={product.name ?? ""}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <ZoruLabel htmlFor="ep-price">Price</ZoruLabel>
                <ZoruInput
                  id="ep-price"
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={priceDecimal}
                />
              </div>
              <div className="grid gap-1.5">
                <ZoruLabel htmlFor="ep-currency">Currency</ZoruLabel>
                <ZoruSelect
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
                </ZoruSelect>
              </div>
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="ep-desc">Description</ZoruLabel>
              <ZoruTextarea
                id="ep-desc"
                name="description"
                rows={3}
                defaultValue={product.description ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="ep-image">Image URL</ZoruLabel>
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
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <EditSubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
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
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
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
                <ZoruSkeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : error ? (
            <ZoruAlert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertTitle>Could not load media</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : media.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <Link
                  key={item.id}
                  href={item.permalink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-square overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line"
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
                  <div className="absolute inset-0 flex items-center justify-center bg-zoru-ink/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="p-1 text-center text-xs text-zoru-bg">
                      View post
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--zoru-radius-sm)] border border-dashed border-zoru-line py-16 text-center text-zoru-ink-muted">
              <ImageIcon className="mx-auto h-10 w-10" />
              <h3 className="mt-3 text-sm font-medium text-zoru-ink">
                No tagged media yet
              </h3>
              <p className="mt-1 text-xs">
                This product has not been tagged in any posts yet.
              </p>
            </div>
          )}
        </div>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
