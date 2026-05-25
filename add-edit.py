import re

with open('src/app/sabsms/lists/lists-table.tsx', 'r') as f:
    content = f.read()

# Add "edit" to DialogKind
content = content.replace('  | "create"\n', '  | "create"\n  | "edit"\n')

# Add toggleListLock and updateList to imports
content = content.replace('estimateDynamicListSize,', 'estimateDynamicListSize,\n  toggleListLock,\n  updateList,')

# Add Edit and Lock row actions
row_actions = """  const rowActions: SabsmsRowAction<ListRecord>[] = [
    {
      label: "Edit list",
      icon: <ListChecks className="h-3.5 w-3.5" />,
      onSelect: (r) => openDialog("edit", r),
    },
    {
      label: "Lock / Unlock",
      icon: <ShieldBan className="h-3.5 w-3.5" />,
      onSelect: (r) => withToast("Toggle lock", () => toggleListLock(r.id, !r.isLocked)),
    },"""
content = content.replace('  const rowActions: SabsmsRowAction<ListRecord>[] = [', row_actions)

with open('src/app/sabsms/lists/lists-table.tsx', 'w') as f:
    f.write(content)
