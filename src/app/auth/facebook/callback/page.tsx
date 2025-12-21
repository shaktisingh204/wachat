import { Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { FacebookCallbackClient } from '@/components/wabasimplify/facebook-callback-client'

type PageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function FacebookCallbackPage({ searchParams }: PageProps) {
  // ✅ MUST await searchParams
  const params = await searchParams

  const code = params.code as string | undefined
  const state = params.state as string | undefined
  const error = params.error_description as string | undefined

  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-muted">
          <Card className="max-w-sm text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
              </div>
              <CardTitle>Loading...</CardTitle>
            </CardHeader>
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
  )
}
