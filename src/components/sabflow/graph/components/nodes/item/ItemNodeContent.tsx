'use client';
import type { BlockItem, BlockType } from '@/lib/sabflow/types';

type Props = {
  item: BlockItem;
  blockType: BlockType;
};

export function ItemNodeContent({ item, blockType }: Props) {
  const text = resolveDisplayText(item, blockType);

  if (!text) {
    return (
      <span className="flex-1 truncate px-3 py-2 text-[12px] italic text-[var(--gray-8)]">
        Empty
      </span>
    );
  }

  return (
    <span className="flex-1 truncate px-3 py-2 text-[12px] text-[var(--gray-12)]">
      {text}
    </span>
  );
}

function resolveDisplayText(item: BlockItem, blockType: BlockType): string {
  switch (blockType) {
    case 'ab_test': {
      const pct = typeof item.percentage === 'number' ? item.percentage : undefined;
      if (pct !== undefined) return `${pct}%`;
      if (typeof item.content === 'string' && item.content.trim()) return item.content;
      return '';
    }
    case 'condition': {
      // Show a summary from condition data if present, else fall back to content
      const conditionData = item.condition;
      if (
        conditionData &&
        typeof conditionData === 'object' &&
        !Array.isArray(conditionData)
      ) {
        const c = conditionData as Record<string, unknown>;
        const parts: string[] = [];
        if (typeof c.variable === 'string' && c.variable) parts.push(c.variable);
        if (typeof c.operator === 'string' && c.operator) parts.push(c.operator);
        if (typeof c.value === 'string' && c.value) parts.push(`"${c.value}"`);
        if (parts.length > 0) return parts.join(' ');
      }
      if (typeof item.content === 'string' && item.content.trim()) return item.content;
      return '';
    }
    case 'choice_input':
    case 'picture_choice_input':
    default: {
      if (typeof item.content === 'string' && item.content.trim()) return item.content;
      return '';
    }
  }
}
