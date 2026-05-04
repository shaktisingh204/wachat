'use client';

/**
 * RegisterPhoneButton (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/register-phone-button. Same server
 * action (registerPhoneNumber), same handler signature.
 */

import * as React from 'react';
import { useTransition } from 'react';
import { CheckSquare, Loader2 } from 'lucide-react';

import { registerPhoneNumber } from '@/app/actions/whatsapp.actions';
import { ZoruButton, useZoruToast } from '@/components/zoruui';

interface RegisterPhoneButtonProps {
  projectId: string;
  phoneNumberId: string;
}

export function RegisterPhoneButton({
  projectId,
  phoneNumberId,
}: RegisterPhoneButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const handleRegister = () => {
    startTransition(async () => {
      const result = await registerPhoneNumber(projectId, phoneNumberId);
      if (result.success) {
        toast({
          title: 'Success',
          description:
            result.message || 'Phone number registration request sent.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruButton
      onClick={handleRegister}
      disabled={isPending}
      variant="outline"
      size="sm"
      block
    >
      {isPending ? <Loader2 className="animate-spin" /> : <CheckSquare />}
      Register
    </ZoruButton>
  );
}
