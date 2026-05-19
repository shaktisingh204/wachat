/**
 * Default `props` shapes for each EmailBuilderBlockType.
 * Used by the block palette when appending and by the inspector when a
 * field is missing on an existing block.
 */
import type { EmailBuilderBlock, EmailBuilderBlockType } from '@/lib/email/types';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function makeDefaultBlock(type: EmailBuilderBlockType): EmailBuilderBlock {
  switch (type) {
    case 'text':
      return {
        id: nextId('text'),
        type,
        props: {
          content: 'Write your copy here. Click to edit.',
          color: '#1a1a1a',
          fontSize: 16,
          padding: 16,
          align: 'left',
        },
      };
    case 'image':
      return {
        id: nextId('image'),
        type,
        props: {
          src: '',
          alt: '',
          width: 600,
          align: 'center',
          padding: 12,
          href: '',
        },
      };
    case 'button':
      return {
        id: nextId('button'),
        type,
        props: {
          label: 'Click me',
          href: 'https://example.com',
          backgroundColor: '#111827',
          textColor: '#ffffff',
          padding: 12,
          borderRadius: 6,
          align: 'center',
        },
      };
    case 'columns':
      return {
        id: nextId('cols'),
        type,
        props: { columns: 2, gap: 12, padding: 12 },
        children: [
          {
            id: nextId('col-text'),
            type: 'text',
            props: { content: 'Column 1', color: '#1a1a1a', fontSize: 14, padding: 8, align: 'left' },
          },
          {
            id: nextId('col-text'),
            type: 'text',
            props: { content: 'Column 2', color: '#1a1a1a', fontSize: 14, padding: 8, align: 'left' },
          },
        ],
      };
    case 'divider':
      return {
        id: nextId('div'),
        type,
        props: { color: '#e5e7eb', thickness: 1, padding: 12 },
      };
    case 'spacer':
      return { id: nextId('spc'), type, props: { height: 24 } };
    case 'social':
      return {
        id: nextId('soc'),
        type,
        props: {
          align: 'center',
          padding: 12,
          networks: [
            { network: 'twitter', url: 'https://twitter.com/' },
            { network: 'instagram', url: 'https://instagram.com/' },
            { network: 'linkedin', url: 'https://linkedin.com/' },
          ],
        },
      };
    case 'video':
      return {
        id: nextId('vid'),
        type,
        props: {
          src: '',
          poster: '',
          href: '',
          width: 600,
          padding: 12,
        },
      };
    case 'footer':
      return {
        id: nextId('foot'),
        type,
        props: {
          companyName: 'Your Company',
          address: '1 Example Street, City',
          unsubscribeText: 'Unsubscribe',
          unsubscribeUrl: '{{unsubscribeUrl}}',
          color: '#6b7280',
          padding: 16,
        },
      };
    case 'html':
      return {
        id: nextId('html'),
        type,
        props: { html: '<p>Custom HTML here</p>' },
      };
    case 'amp':
      return {
        id: nextId('amp'),
        type,
        props: { amp: '' },
      };
    default:
      return { id: nextId('blk'), type, props: {} };
  }
}

export function emptyDocument(): import('@/lib/email/types').EmailBuilderDocument {
  return {
    version: 1,
    settings: {
      backgroundColor: '#f4f4f7',
      contentBackgroundColor: '#ffffff',
      fontFamily: 'Inter, Arial, sans-serif',
      width: 600,
      preheader: '',
    },
    blocks: [],
  };
}
