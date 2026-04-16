'use client';
import type { Block } from '@/lib/sabflow/types';
import { getBlockLabel } from '@/lib/sabflow/blocks';

type Props = {
  block: Block;
};

export function BlockNodeContent({ block }: Props) {
  const label = getBlockLabel(block.type);

  // Show a brief preview of the block's content/options when available
  const preview = getBlockPreview(block);

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[12.5px] font-medium text-[var(--gray-12)] truncate">{label}</div>
      {preview && (
        <div className="text-[11px] text-[var(--gray-9)] truncate mt-0.5">{preview}</div>
      )}
    </div>
  );
}

function getBlockPreview(block: Block): string | null {
  const options = block.options;
  if (!options) return null;

  switch (block.type) {
    case 'text':
      if (typeof options.content === 'string') return options.content.slice(0, 60);
      return null;
    case 'text_input':
      if (typeof options.labels === 'object' && options.labels) {
        const labels = options.labels as Record<string, unknown>;
        if (typeof labels.placeholder === 'string') return labels.placeholder;
      }
      return null;
    case 'webhook':
      if (typeof options.url === 'string') return options.url.slice(0, 60);
      return null;
    case 'send_email':
      if (typeof options.subject === 'string') return options.subject.slice(0, 60);
      return null;
    case 'script':
      if (typeof options.code === 'string') return options.code.slice(0, 60).replace(/\n/g, ' ');
      return null;
    case 'set_variable':
      if (typeof options.variableId === 'string') return `var: ${options.variableId}`;
      return null;
    case 'redirect':
      if (typeof options.url === 'string') return options.url.slice(0, 60);
      return null;
    case 'condition':
      return 'If / Else';
    case 'wait':
      if (typeof options.secondsToWaitFor === 'number') {
        return `Wait ${options.secondsToWaitFor}s`;
      }
      return null;
    default:
      return null;
  }
}
