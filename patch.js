const fs = require('fs');
const file = 'src/app/dashboard/hrm/payroll/professional-tax/_components/professional-tax-form.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add currentUserId to props
content = content.replace(
  'interface ProfessionalTaxFormProps {',
  'interface ProfessionalTaxFormProps {\n    currentUserId?: string | null;'
);
content = content.replace(
  'export function ProfessionalTaxForm({ initialData }: ProfessionalTaxFormProps) {',
  'export function ProfessionalTaxForm({ initialData, currentUserId }: ProfessionalTaxFormProps) {'
);

// 2. Import useEntityDraft and useRef
content = content.replace(
  "import { indianStates } from '@/lib/states';",
  "import { indianStates } from '@/lib/states';\nimport { useEntityDraft } from '@/components/crm/use-entity-draft';\nimport { useRef } from 'react';"
);

fs.writeFileSync(file, content);
