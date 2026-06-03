const fs = require('fs');
const file = 'src/app/dashboard/sabdesk/my-tickets/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace mock data generation
content = content.replace(
  /const generateTickets = \([\s\S]*?const MOCK_TICKETS = generateTickets\(1200\);/m,
  "import { listTickets } from '@/app/actions/crm/tickets.actions';"
);

// Replace useState initialization
content = content.replace(
  /const \[tickets, setTickets\] = useState<Ticket\[\]>\(MOCK_TICKETS\);/,
  "const [tickets, setTickets] = useState<Ticket[]>([]);"
);

// Replace useEffect for loading
content = content.replace(
  /useEffect\(\(\) => \{\n\s*\/\/ Simulate loading\n\s*const timer = setTimeout\(\(\) => setIsLoading\(false\), 800\);\n\s*return \(\) => clearTimeout\(timer\);\n\s*\}, \[\]\);/m,
  `useEffect(() => {
    async function fetchTickets() {
      setIsLoading(true);
      try {
        const res = await listTickets({ limit: 100 });
        if (res.tickets) {
          setTickets(res.tickets.map(t => ({
            id: String(t._id),
            subject: t.subject || 'No Subject',
            requester: t.requesterId || 'Unknown',
            requesterEmail: 'unknown@example.com',
            status: (t.status || 'open') as TicketStatus,
            priority: (t.priority || 'medium') as TicketPriority,
            createdAt: t.createdAt || new Date().toISOString(),
            lastUpdated: t.updatedAt || new Date().toISOString(),
            tags: [],
            replies: 0,
            slaBreach: false,
            satisfaction: null
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTickets();
  }, []);`
);

fs.writeFileSync(file, content);
