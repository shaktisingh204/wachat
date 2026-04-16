import type { BlockType } from '@/lib/sabflow/types';

export function getItemName(blockType: BlockType): string {
  switch (blockType) {
    case 'choice_input':
      return 'choice';
    case 'picture_choice_input':
      return 'picture choice';
    case 'condition':
      return 'condition';
    case 'ab_test':
      return 'variant';
    default:
      return 'item';
  }
}
