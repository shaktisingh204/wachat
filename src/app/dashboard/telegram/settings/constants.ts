export const PARSE_MODES = [
    { value: 'HTML', label: 'HTML' },
    { value: 'MarkdownV2', label: 'MarkdownV2' },
    { value: 'plain', label: 'Plain text' },
] as const;

export const IANA_TIMEZONES = [
    'UTC', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
    'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Chicago',
    'America/Denver', 'America/Halifax', 'America/Lima', 'America/Los_Angeles', 'America/Mexico_City',
    'America/New_York', 'America/Phoenix', 'America/Sao_Paulo', 'America/Santiago',
    'America/Toronto', 'America/Vancouver', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai',
    'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Karachi',
    'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Riyadh', 'Asia/Seoul',
    'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tashkent', 'Asia/Tehran',
    'Asia/Tokyo', 'Asia/Yerevan', 'Atlantic/Reykjavik', 'Australia/Adelaide', 'Australia/Brisbane',
    'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam',
    'Europe/Athens', 'Europe/Berlin', 'Europe/Bucharest', 'Europe/Brussels', 'Europe/Copenhagen',
    'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kyiv', 'Europe/Lisbon',
    'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris',
    'Europe/Prague', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw',
    'Europe/Zurich', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu',
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
