const fs = require('fs');
const file = 'src/app/dashboard/crm/messages/_components/conversations-pane.tsx';

let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { UserCircle2 } from 'lucide-react';",
  "import { UserCircle2, Plus } from 'lucide-react';\nimport { useState } from 'react';\nimport { Button, Input, Modal } from '@/components/zoruui';\nimport { useRouter } from 'next/navigation';"
);

code = code.replace(
  "export function ConversationsPane({ conversations, activePeerId }: ConversationsPaneProps) {\n  return (",
  `export function ConversationsPane({ conversations, activePeerId }: ConversationsPaneProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPeerId, setNewPeerId] = useState('');
  
  const totalUnread = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  const handleStartChat = () => {
    if (newPeerId.trim()) {
      setIsModalOpen(false);
      router.push(\`/dashboard/crm/messages/\${newPeerId.trim()}\`);
    }
  };

  return (
    <>
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <div className="p-6">
          <h2 className="text-lg font-medium mb-4">Start New Conversation</h2>
          <Input 
            value={newPeerId} 
            onChange={(e) => setNewPeerId(e.target.value)} 
            placeholder="User ID to chat with..." 
            className="mb-4"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleStartChat} disabled={!newPeerId.trim()}>Start Chat</Button>
          </div>
        </div>
      </Modal>
`
);

code = code.replace(
  "      <div className=\"border-b border-border px-4 py-3\">\n        <p className=\"text-[12.5px] font-medium text-muted-foreground\">Conversations</p>\n      </div>",
  `      <div className="border-b border-border px-4 py-3 flex justify-between items-center">
        <p className="text-[12.5px] font-medium text-muted-foreground flex items-center gap-2">
          Conversations
          {totalUnread > 0 && (
            <ClayBadge tone="rose" className="h-4 px-1.5 text-[10px] leading-none">
              {totalUnread}
            </ClayBadge>
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setIsModalOpen(true)} className="h-6 px-2 text-xs">
          <Plus className="h-3 w-3 mr-1" /> New
        </Button>
      </div>`
);

code = code.replace(
  "    </ClayCard>\n  );\n}",
  "    </ClayCard>\n    </>\n  );\n}"
);

fs.writeFileSync(file, code);
