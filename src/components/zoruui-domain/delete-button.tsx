'use client';

import { useState, useTransition } from 'react';
import {
    Button,
    ZoruAlertDialog as AlertDialog,
    ZoruAlertDialogAction as AlertDialogAction,
    ZoruAlertDialogCancel as AlertDialogCancel,
    ZoruAlertDialogContent as AlertDialogContent,
    ZoruAlertDialogDescription as AlertDialogDescription,
    ZoruAlertDialogFooter as AlertDialogFooter,
    ZoruAlertDialogHeader as AlertDialogHeader,
    ZoruAlertDialogTitle as AlertDialogTitle,
    ZoruAlertDialogTrigger as AlertDialogTrigger,
    useZoruToast,
} from "@/components/zoruui";
import { Loader2, Trash2 } from "lucide-react";

interface DeleteButtonProps {
    id: string;
    action: (id: string) => Promise<{ success: boolean; error?: string }>;
    resourceName?: string;
    disabled?: boolean;
}

export function DeleteButton({ id, action, resourceName = "Item", disabled = false }: DeleteButtonProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const handleDelete = async () => {
        startTransition(async () => {
            try {
                const result = await action(id);
                if (result.success) {
                    toast({
                        title: "Deleted",
                        description: `${resourceName} deleted successfully.`,
                    });
                    setOpen(false);
                } else {
                    toast({
                        title: "Error",
                        description: result.error || "Failed to delete.",
                        variant: "destructive",
                    });
                }
            } catch (error) {
                toast({
                    title: "Error",
                    description: "An unexpected error occurred.",
                    variant: "destructive",
                });
            }
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[var(--st-danger)] hover:text-[var(--st-danger)] hover:bg-[var(--st-bg-muted)]" disabled={disabled}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the {resourceName.toLowerCase()}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        className="bg-[var(--st-danger)] text-[var(--st-danger)] hover:opacity-90"
                        disabled={isPending}
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
