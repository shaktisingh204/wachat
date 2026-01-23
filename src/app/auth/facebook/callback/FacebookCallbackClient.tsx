
'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { handleFacebookOAuthCallback } from '@/app/actions/facebook.actions'
import { LoaderCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

type Props = {
  code?: string
  error?: string
  stateFromUrl?: string
}

export default function FacebookCallbackClient({
  code,
  error,
  stateFromUrl,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (error) {
      toast({
        title: 'Connection Failed',
        description: error,
        variant: 'destructive',
      })
      router.replace('/dashboard/facebook/all-projects')
      return
    }

    if (!code || !stateFromUrl) {
      toast({
        title: 'Connection Cancelled',
        description: 'The connection process was cancelled or no code was provided.',
        variant: 'default',
      })
      router.replace('/dashboard/facebook/all-projects');
      return;
    }

    startTransition(async () => {
      const result = await handleFacebookOAuthCallback(code, stateFromUrl);

      if (result.success) {
        toast({
          title: 'Connection Successful!',
          description: 'Your account has been connected.',
        })
        router.replace(result.redirectPath || '/dashboard')
      } else {
        toast({
          title: 'Connection Failed',
          description: result.error || 'An unknown error occurred.',
          variant: 'destructive',
        })
        router.replace('/dashboard/facebook/all-projects')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, error, stateFromUrl, router, toast])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted">
      <Card className="max-w-sm text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
          </div>
          <CardTitle>Finalizing connection, please wait…</CardTitle>
          <CardDescription>
            This may take a moment. Do not close this window.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
