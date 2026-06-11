import { redirect } from 'next/navigation';

/** Legacy single-board route → the unified deals board. */
export default function SabbiginPipelineRedirect() {
  redirect('/dashboard/sabbigin/deals?view=board');
}
