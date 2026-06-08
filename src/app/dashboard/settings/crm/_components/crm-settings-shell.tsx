'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';
// Pull the new ui20 CRM theme so settings pages match the rest of the CRM.
import '@/components/sabcrm/20ui/tokens-crm.css';

/**
 * CrmSettingsShell — centres every `/dashboard/settings/crm/*` page in a
 * readable column with a Back button on top, and establishes the ui20 design
 * scope. The theme class follows the app's light/dark so the settings pages
 * never render half-dark against the surrounding dashboard.
 */
export function CrmSettingsShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const [appDark, setAppDark] = React.useState(false);

  React.useEffect(() => {
    const html = document.documentElement;
    const sync = (): void => setAppDark(html.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className={`sabcrm-twenty 20ui ${appDark ? 'dark st-theme-dark' : 'light'} h-full overflow-y-auto bg-[var(--st-bg-secondary)] text-[var(--st-text)]`}
    >
      <div className="mx-auto max-w-[1120px] px-[var(--st-space-5)] pb-[var(--st-space-6)] pt-[var(--st-space-4)]">
        <div className="mb-[var(--st-space-4)] flex items-center">
          <Button variant="ghost" iconLeft={ArrowLeft} onClick={() => router.back()}>
            Back
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default CrmSettingsShell;
