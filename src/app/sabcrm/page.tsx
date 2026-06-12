import { SabcrmHomeClient } from './home-client';

export const metadata = {
  title: 'SabCRM',
};

/**
 * SabCRM landing (`/sabcrm`).
 *
 * A live, data-driven object hub. The dynamic surface lives in
 * {@link SabcrmHomeClient} (client) — it reads the workspace's real objects +
 * record counts; this server entry only carries route `metadata`.
 *
 * Rendered inside the layout's suite frame on the 20ui design system
 * (`@/components/sabcrm/20ui` components + page-local `hub.css`).
 */
export default function SabcrmHomePage(): React.JSX.Element {
  return <SabcrmHomeClient />;
}
