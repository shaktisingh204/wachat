'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions'
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
        title: 'Onboarding Failed',
        description: error,
        variant: 'destructive',
      })
      router.replace('/dashboard/setup')
      return
    }

    if (!code || !stateFromUrl) return

    startTransition(async () => {
      const result = await handleWabaOnboarding({ code })

      if (result.success) {
        toast({
          title: 'Connection Successful!',
          description: 'Your WhatsApp account has been connected.',
        })
        router.replace('/dashboard')
      } else {
        toast({
          title: 'Onboarding Failed',
          description: result.error || 'An unknown error occurred.',
          variant: 'destructive',
        })
        router.replace('/dashboard/setup')
      }
    })
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
