import 'server-only';
import { cache } from 'react';

import { getSession as _getSession } from '@/app/actions/user.actions';
import { getProjects as _getProjects } from '@/app/actions/project.actions';

// Per-request memoization. A single render pass through the App Router can
// touch `getSession` from the layout, `RBACGuard`, and a page; without this
// each call hits Mongo again (users + plans + sometimes a credits write).
// `React.cache` dedupes by call signature within one request lifecycle.
export const getCachedSession = cache(() => _getSession());

// Same idea for the unfiltered project list used to seed `ProjectProvider`.
// We intentionally only cache the no-arg variant — filtered queries from
// search UIs should not be deduped with the full list.
export const getCachedProjects = cache(() => _getProjects());
