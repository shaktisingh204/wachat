'use client';

import { Button } from '@/components/sabcrm/20ui';
import {
  useTransition } from 'react';
import { CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { registerPhoneNumber } from '@/app/actions/whatsapp.actions';

/**
 * RegisterPhoneButton (wachat-local, 20ui).
 *
 * Replaces the legacy register-phone-button. Same server
 * action (registerPhoneNumber), same handler signature.
 */

import * as React from 'react';

interface RegisterPhoneButtonProps {
  projectId: string;
  phoneNumberId: string;
}

export function RegisterPhoneButton({
  projectId,
  phoneNumberId,
}: RegisterPhoneButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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
    <Button
      onClick={handleRegister}
      loading={isPending}
      iconLeft={CheckSquare}
      variant="outline"
      size="sm"
      block
    >
      Register
    </Button>
  );
}
