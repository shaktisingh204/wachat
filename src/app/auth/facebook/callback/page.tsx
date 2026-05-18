import { ZoruCard, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'

import FacebookCallbackClient from './FacebookCallbackClient'

type PageProps = {
  // Next.js 16: searchParams is a Promise
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function FacebookCallbackPage({
  searchParams,
}: PageProps) {
  // ✅ unwrap promise
  const params = await searchParams

  const code = params.code as string | undefined
  const state = params.state as string | undefined
  const error = params.error_description as string | undefined

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-muted">
          <ZoruCard className="max-w-sm text-center">
            <ZoruCardHeader>
              <div className="flex justify-center mb-4">
                <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
              </div>
              <ZoruCardTitle>Loading...</ZoruCardTitle>
            </ZoruCardHeader>
          </ZoruCard>
        </div>
      }
    >
      <FacebookCallbackClient
        code={code}
        error={error}
        stateFromUrl={state}
      />
    </Suspense>
  )
}
