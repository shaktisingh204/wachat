export const ROWS = [
  { name: "Pricing-page redesign", owner: "Aria Patel", status: "Active", updated: "2h ago" },
  { name: "Onboarding flow", owner: "Sam Chen", status: "Paused", updated: "1d ago" },
  { name: "Q3 announcement", owner: "Lin Wu", status: "Active", updated: "4d ago" },
];

export interface DataRow {
  id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
}

export const DATA_TABLE_ROWS: DataRow[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `${i}`,
  name: `Member ${i + 1}`,
  email: `member${i + 1}@example.com`,
  role: i % 3 === 0 ? "Admin" : "Editor",
  joined: `2026-0${(i % 9) + 1}-12`,
}));

export const DATA_TABLE_COLUMNS = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "joined", header: "Joined" },
];

export const CHART_DATA = [
  { day: "Mon", sent: 1240, delivered: 1198 },
  { day: "Tue", sent: 1380, delivered: 1331 },
  { day: "Wed", sent: 1520, delivered: 1489 },
  { day: "Thu", sent: 1410, delivered: 1378 },
  { day: "Fri", sent: 1690, delivered: 1648 },
  { day: "Sat", sent: 1110, delivered: 1090 },
  { day: "Sun", sent: 980, delivered: 962 },
];

export const CALENDAR_EVENTS = [
  { id: "e1", date: new Date(), title: "Standup" },
  { id: "e2", date: new Date(Date.now() + 86400000 * 2), title: "Sprint review" },
  { id: "e3", date: new Date(Date.now() + 86400000 * 5), title: "Customer call" },
];

export const TESTIMONIALS = [
  {
    text: "ZoruUI made the dashboard feel calm again. Removing the multi-tab strip alone gave us back a third of the chrome.",
    name: "Aria Patel",
    role: "Head of Design, Acme",
    image: "https://i.pravatar.cc/96?img=12",
  },
  {
    text: "The neutral palette was a tougher sell than I thought — until our team saw how much faster scanning data tables got.",
    name: "Sam Chen",
    role: "Engineering Lead, Globex",
    image: "https://i.pravatar.cc/96?img=15",
  },
  {
    text: "Reusing the dock and dropping the URL-tab system meant migration risk dropped to almost zero.",
    name: "Lin Wu",
    role: "Staff Engineer, Initech",
    image: "https://i.pravatar.cc/96?img=33",
  },
  {
    text: "Cards finally look like cards. Tables finally look like tables. No more rainbow surfaces.",
    name: "Mira Singh",
    role: "Product Manager, Soylent",
    image: "https://i.pravatar.cc/96?img=20",
  },
  {
    text: "The data-table primitive replaced four bespoke implementations across our CRM in a single afternoon.",
    name: "Diego Cruz",
    role: "Senior Frontend, Umbrella",
    image: "https://i.pravatar.cc/96?img=24",
  },
  {
    text: "Quiet, fast, accessible — and the hero pill still ships.",
    name: "Tomás Reyes",
    role: "Founder, Wonka",
    image: "https://i.pravatar.cc/96?img=27",
  },
];

export const SAMPLE_FILES = [
  {
    id: "f1",
    name: "Brand deck.pdf",
    mime: "application/pdf",
    size: 4_200_000,
    modified: new Date(),
  },
  {
    id: "f2",
    name: "Hero.png",
    mime: "image/png",
    size: 1_800_000,
    modified: new Date(),
    thumbnailUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=60",
  },
  {
    id: "f3",
    name: "Soundtrack.mp3",
    mime: "audio/mpeg",
    size: 6_400_000,
    modified: new Date(),
  },
];
