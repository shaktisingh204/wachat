#!/bin/bash
sed -i '' 's/action: { type: "delete", id: string }/action: { type: "delete", id?: string, ids?: string[] }/g' src/app/dashboard/hrm/payroll/shifts/_components/shifts-client.tsx
sed -i '' 's/return state.filter(s => s._id !== action.id);/if (action.ids) { return state.filter(s => !action.ids!.includes(s._id)); } return state.filter(s => s._id !== action.id);/g' src/app/dashboard/hrm/payroll/shifts/_components/shifts-client.tsx
sed -i '' 's/addOptimisticShift({ type: "delete", id });\n        startDeleteTransition(async () => {\n            let successCount = 0;/addOptimisticShift({ type: "delete", ids: Array.from(selectedIds) });\n        startDeleteTransition(async () => {\n            let successCount = 0;/g' src/app/dashboard/hrm/payroll/shifts/_components/shifts-client.tsx
