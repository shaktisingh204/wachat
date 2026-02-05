export class LogParser {
    static parseCommonLogFormat(line: string) {
        // Simple regex for CLF
        const regex = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+)/;
        const match = line.match(regex);
        if (match) {
            return {
                ip: match[1],
                timestamp: match[2],
                method: match[3],
                url: match[4],
                status: parseInt(match[6]),
                size: parseInt(match[7])
            };
        }
        return null;
    }

    static isBot(userAgent: string) {
        userAgent = userAgent.toLowerCase();
        if (userAgent.includes('googlebot')) return 'Googlebot';
        if (userAgent.includes('bingbot')) return 'Bingbot';
        if (userAgent.includes('ahrefsbot')) return 'AhrefsBot';
        return 'User';
    }
}
