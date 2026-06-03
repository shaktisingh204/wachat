const fs = require('fs');
const file = 'src/app/dashboard/sabdesk/social-inbox/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const generateMockMessages = \([\s\S]*?const initialMessages = generateMockMessages\(150\);/m,
  "import { getSocialInboxMessages } from '@/app/actions/sabdesk-assist.actions';"
);

content = content.replace(
  /const \[messages, setMessages\] = useState<SocialMessage\[\]>\(initialMessages\);/,
  "const [messages, setMessages] = useState<SocialMessage[]>([]);\n  const [isLoading, setIsLoading] = useState(true);\n\n  useEffect(() => {\n    async function loadData() {\n      setIsLoading(true);\n      try {\n        const res = await getSocialInboxMessages();\n        if (res.success && res.data) {\n          setMessages(res.data as unknown as SocialMessage[]);\n        }\n      } catch (err) {\n        console.error(err);\n      } finally {\n        setIsLoading(false);\n      }\n    }\n    loadData();\n  }, []);"
);

fs.writeFileSync(file, content);
