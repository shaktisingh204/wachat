
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CrmProductForm } from './crm-product-form';

interface CrmProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  product?: any | null; // Keep as any to avoid breaking existing calls
  onSuccess: () => void;
}

// This component is now deprecated and will be removed in a future update.
// The functionality has been moved to dedicated pages.
export function CrmProductDialog({ isOpen, onOpenChange, currency, product, onSuccess }: CrmProductDialogProps) {
  
  useEffect(() => {
    if (isOpen) {
      console.warn("CrmProductDialog is deprecated. Please use the new dedicated pages for adding/editing products.");
      onOpenChange(false);
    }
  }, [isOpen, onOpenChange]);

  return null;
}
