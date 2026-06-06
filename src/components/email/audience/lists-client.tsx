'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import {
  Button,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  actionArchiveEmailList,
  actionListEmailLists,
} from '@/app/actions/email/audience.actions';
import type { EmailListDoc } from '@/lib/rust-client/email-audience';
import { EmailListTable } from './list-table';
import { EmailListFormDrawer } from './list-form-drawer';

export function EmailListsClient() {
  const [lists, setLists] = useState<EmailListDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EmailListDoc | null>(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    const result = await actionListEmailLists({ limit: 100 });
    if (!result.ok) {
      zoruToast({ title: 'Failed to load lists', description: result.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setLists(result.data.items);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchLists(); }, [fetchLists]);

  const handleArchive = useCallback(async (list: EmailListDoc) => {
    const result = await actionArchiveEmailList(list._id);
    if (!result.ok) {
      zoruToast({ title: 'Archive failed', description: result.error, variant: 'destructive' });
      return;
    }
    zoruToast({ title: `Archived "${list.name}"` });
    await fetchLists();
  }, [fetchLists]);

  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Users className="h-6 w-6" /> Audience lists
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Group subscribers into lists. Each list has its own signup form and default sender.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
          >
            <Plus className="h-4 w-4" /> New list
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <EmailListTable
          lists={lists}
          onEdit={(list) => { setEditing(list); setDrawerOpen(true); }}
          onArchive={handleArchive}
        />
      )}

      <EmailListFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        list={editing}
        onSaved={fetchLists}
      />
    </div>
  );
}
