import "@/components/sabcrm/20ui/tokens.css";
import { Suspense } from 'react';
import ClientPage from './page.client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

export default function Page(props: any) {
  return (
    <div className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Frame-buster: if a desktop app-window's session expires, the app
          redirects the iframe to /login — break out to the top window so the
          user re-authenticates on the real page, not inside a dead window. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "if(window.top!==window.self){try{window.top.location.href='/login';}catch(e){}}",
        }}
      />
      <Suspense fallback={<Loading />}>
        <ClientPage {...props} />
      </Suspense>
    </div>
  );
}
