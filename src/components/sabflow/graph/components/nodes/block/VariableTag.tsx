'use client';
import { LuBraces } from 'react-icons/lu';

type Props = {
  variableName: string;
};

/**
 * Renders a `{{variableName}}` reference as an inline highlighted chip.
 * Orange background matches Typebot's variable tag style, adapted for SabFlow.
 */
export function VariableTag({ variableName }: Props) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 rounded px-1 py-0.5 text-[10px] font-mono break-all leading-tight">
      <LuBraces className="shrink-0 h-2.5 w-2.5" />
      {variableName}
    </span>
  );
}
