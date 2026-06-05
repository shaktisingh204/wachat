/**
 * /sabcrm/20ui — the 20ui design-system gallery, inside the CRM frame.
 *
 * Renders the shared {@link Ui20Showcase}. The same gallery is served standalone
 * (outside the CRM) at `/demo20`, proving 20ui works app-wide.
 */

import { Ui20Showcase } from '@/components/sabcrm/ui20-showcase';

export default function Page() {
  return <Ui20Showcase />;
}
