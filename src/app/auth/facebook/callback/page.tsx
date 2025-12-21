
// The page is a Server Component to correctly await `searchParams`.
// It then renders a Client Component, passing the data as props.
// The Client Component handles all the hook-based logic.

import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FacebookCallbackClient } from '@/components/wabasimplify/facebook-callback-client';

// The main page is a Server Component
export default async function FacebookCallbackPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // `searchParams` is a promise in the App Router and must be awaited.
  const code = searchParams.code as string | undefined;
  const state = searchParams.state as string | undefined;
  const error = searchParams.error_description as string | undefined;
  
  // Render a client component and pass the server-side data as props
  return (
      <Suspense fallback={
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
      }>
          <FacebookCallbackClient code={code} error={error} stateFromUrl={state} />
      </Suspense>
  )
}
