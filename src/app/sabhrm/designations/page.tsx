import { listDesignations, getDesignationPickerOptions } from "@/app/actions/sabhrm/designations.actions";

import { DesignationsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmDesignationsPage() {
  const [list, opts] = await Promise.all([
    listDesignations({ page: 1, pageSize: 25 }),
    getDesignationPickerOptions(),
  ]);

  return (
    <DesignationsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      options={opts.ok ? opts.data : { departments: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}
