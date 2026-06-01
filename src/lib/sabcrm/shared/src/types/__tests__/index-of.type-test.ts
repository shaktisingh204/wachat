import { type Equal, type Expect } from '@/lib/sabcrm/shared/src/testing';

import { type IndexOf } from '@/lib/sabcrm/shared/src/types/IndexOf.type';

type Versions = readonly ['1.20.0', '1.21.0', '1.22.0', '1.23.0'];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Assertions = [
  Expect<Equal<IndexOf<'1.20.0', Versions>, 0>>,
  Expect<Equal<IndexOf<'1.21.0', Versions>, 1>>,
  Expect<Equal<IndexOf<'1.22.0', Versions>, 2>>,
  Expect<Equal<IndexOf<'1.23.0', Versions>, 3>>,

  // Not found resolves to never
  Expect<Equal<IndexOf<'1.99.0', Versions>, never>>,

  // Single element tuple
  Expect<Equal<IndexOf<'a', readonly ['a']>, 0>>,

  // Empty tuple
  Expect<Equal<IndexOf<'a', readonly []>, never>>,
];
