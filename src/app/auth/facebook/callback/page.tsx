import "@/components/sabcrm/20ui/zoru-legacy.css";

import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, Button } from '@/components/sabcrm/20ui/compat';
import { Suspense } from 'react'
import { LoaderCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

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
  const error = (params.error_description as string | undefined) || (params.error as string | undefined)

  // 1. Track OAuth success/failure metrics directly from server component
  if (error) {
    console.error(`[Facebook OAuth Metric] Failed callback:`, { error, state });
  } else if (!code) {
    console.warn(`[Facebook OAuth Metric] Invalid callback (no code):`, { state });
  } else {
    console.info(`[Facebook OAuth Metric] Success callback code received:`, { state });
  }

  const getRedirectPath = (s: string | undefined) => {
    switch (s) {
      case 'whatsapp': return '/wachat';
      case 'facebook': return '/dashboard/facebook/all-projects';
      case 'ad_manager': return '/dashboard/ad-manager/ad-accounts';
      case 'instagram': return '/dashboard/instagram/connections';
      default: return '/dashboard/facebook/all-projects';
    }
  };

  // 2. Inline fallback for invalid code or errors (fails entirely)
  if (error || !code || !state) {
    return (
      <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
        <div className="flex h-screen w-screen items-center justify-center bg-[var(--st-bg-secondary)]">
          <Card className="max-w-sm text-center">
            <ZoruCardHeader>
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-[var(--st-text)]" />
              </div>
              <ZoruCardTitle>Connection Failed</ZoruCardTitle>
              <ZoruCardDescription>
                {error
                  ? `Error: ${error}`
                  : "No connection code or state was provided. The process might have been cancelled."}
              </ZoruCardDescription>
            </ZoruCardHeader>
            <div className="p-6 pt-0">
              <Link href={getRedirectPath(state)}>
                <Button variant="outline" className="w-full">Return to Dashboard</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <Suspense
        fallback={
          <div className="flex h-screen w-screen items-center justify-center bg-[var(--st-bg-secondary)]">
            <Card className="max-w-sm text-center">
              <ZoruCardHeader>
                <div className="flex justify-center mb-4">
                  <LoaderCircle className="h-10 w-10 animate-spin text-[var(--st-text)]" />
                </div>
                <ZoruCardTitle>Loading...</ZoruCardTitle>
              </ZoruCardHeader>
            </Card>
          </div>
        }
      >
        <FacebookCallbackClient
          code={code}
          error={error}
          stateFromUrl={state}
        />
      </Suspense>
    </div>
  )
}
