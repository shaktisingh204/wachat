import { type ReactNode } from 'react';
import { type TipTapMark } from '@/lib/sabcrm/shared/utils';

export const strike = (_: TipTapMark, children: ReactNode): ReactNode => {
  return <span style={{ textDecoration: 'line-through' }}>{children}</span>;
};
