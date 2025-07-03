
'use client';

import { useState } from 'react';
import { useToast } from './use-toast';

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const copy = (text: string) => {
    if (!navigator.clipboard) {
      toast({
        title: 'Failed to copy',
        description: 'Clipboard API is not available. Please use a secure (HTTPS) connection.',
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({ title: 'Copied to clipboard!' });
      },
      (err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Failed to copy',
          description: 'Could not copy to clipboard. Check browser permissions.',
          variant: 'destructive',
        });
      }
    );
  };

  return { isCopied, copy };
}
