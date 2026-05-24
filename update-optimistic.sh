#!/bin/bash
sed -i '' 's/const filteredShifts = useMemo(() => {/const [optimisticShifts, addOptimisticShift] = useOptimistic(\n        shifts,\n        (state, action: { type: "delete", id: string }) => {\n            if (action.type === "delete") {\n                return state.filter(s => s._id !== action.id);\n            }\n            return state;\n        }\n    );\n\n    const filteredShifts = useMemo(() => {/g' src/app/dashboard/hrm/payroll/shifts/_components/shifts-client.tsx

sed -i '' 's/return shifts.filter(s => {/return optimisticShifts.filter(s => {/g' src/app/dashboard/hrm/payroll/shifts/_components/shifts-client.tsx

sed -i '' 's/startDeleteTransition(async () => {/addOptimisticShift({ type: "delete", id });\n        startDeleteTransition(async () => {/g' src/app/dashboard/hrm/payroll/shifts/_components/shifts-client.tsx

