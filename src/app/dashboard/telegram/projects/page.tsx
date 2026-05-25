import { Suspense } from 'react';
import ClientPage from './page.client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

export default function Page(props: any) {
  return (
    <Suspense fallback={<Loading />}>
      <ClientPage {...props} />
    </Suspense>
  );
}
