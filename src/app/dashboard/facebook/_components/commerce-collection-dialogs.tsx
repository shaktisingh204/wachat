"use client";

import { Alert, AlertDescription, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useTransition } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle,
  Loader2,
  PlusCircle,
  Trash2 } from "lucide-react";

import {
  createProductSet,
  deleteProductSet,
  } from "@/app/actions/catalog.actions";

/**
 * Commerce › Collection dialogs (ui20-only).
 *
 * Wraps the existing server actions:
 *   - createProductSet (`createProductSet`)
 *   - deleteProductSet (`deleteProductSet`)
 *
 * Pure Ui20 primitives.
 */

import * as React from "react";

/* ------------------------------------------------------------------ */
/* Create collection                                                  */
/* ------------------------------------------------------------------ */

const initialState: { message: string | null; error: string | null; success?: boolean } = {
  message: null,
  error: null,
};

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
      {pending ? "Creating…" : "Create collection"}
    </Button>
  );
}

export interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  projectId: string;
  onCreated?: () => void;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  catalogId,
  projectId,
  onCreated,
}: CreateCollectionDialogProps) {
  const [state, formAction] = useActionState(
    createProductSet,
    initialState as any,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.success && state?.message) {
      toast({
        title: "Collection created",
        description: state.message,
        variant: "success",
      });
      formRef.current?.reset();
      onOpenChange(false);
      onCreated?.();
    }
  }, [state, toast, onOpenChange, onCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Create new collection</DialogTitle>
            <DialogDescription>
              Group products into a set within this catalog. You can assign
              products in Commerce Manager.
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

          <div className="grid gap-1.5">
            <Label htmlFor="cc-name">Collection name</Label>
            <Input
              id="cc-name"
              name="name"
              placeholder="e.g. Summer Collection"
              required
            />
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
/* Delete collection                                                  */
/* ------------------------------------------------------------------ */

export interface DeleteCollectionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: { id: string; name?: string } | null;
  projectId: string;
  onDeleted?: () => void;
}

export function DeleteCollectionConfirmDialog({
  open,
  onOpenChange,
  collection,
  projectId,
  onDeleted,
}: DeleteCollectionConfirmDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!collection) return;
    startTransition(async () => {
      const result = await deleteProductSet(collection.id, projectId);
      if (result.success) {
        toast({
          title: "Collection deleted",
          description: "The product set was removed.",
          variant: "success",
        });
        onOpenChange(false);
        onDeleted?.();
      } else {
        toast({
          title: "Could not delete collection",
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
          <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
          <AlertDialogDescription>
            {collection?.name
              ? `This will permanently delete the “${collection.name}” product set. The underlying products are not deleted.`
              : "This will permanently delete the selected product set. The underlying products are not deleted."}
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
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
