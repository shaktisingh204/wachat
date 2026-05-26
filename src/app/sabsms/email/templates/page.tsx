import { BuilderShell } from '@/components/email/templates/builder/builder-shell';
import { emptyDocument } from '@/components/email/templates/builder/block-defaults';

export default function VisualEmailEditorPage() {
  return (
    <BuilderShell
      templateId="new"
      initialName="New Email Template"
      initialDoc={emptyDocument()}
    />
  );
}
