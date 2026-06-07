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
 * Rendered inside the layout's `TwentyAppFrame` (`.sabcrm-twenty` scope), so
 * all visuals come from the `.st-*` Twenty design system. No Ui20 / Tailwind.
 */
export default function SabcrmHomePage(): React.JSX.Element {
  return <SabcrmHomeClient />;
}
