import "@/styles/zoruui.css";
import { Suspense } from 'react';
import ClientPage from './page.client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

export default function Page(props: any) {
  return (
    <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <Suspense fallback={<Loading />}>
        <ClientPage {...props} />
      </Suspense>
    </div>
  );
}
