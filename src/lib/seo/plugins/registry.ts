import { SeoPageIssue } from '../definitions';

type AuditPlugin = {
    name: string;
    check: (html: string, url: string) => SeoPageIssue[];
};

class PluginRegistry {
    private plugins: AuditPlugin[] = [];

    register(plugin: AuditPlugin) {
        this.plugins.push(plugin);
        console.log(`[Plugin] Registered: ${plugin.name}`);
    }

    runAll(html: string, url: string): SeoPageIssue[] {
        let issues: SeoPageIssue[] = [];
        for (const plugin of this.plugins) {
            try {
                const pluginIssues = plugin.check(html, url);
                issues = [...issues, ...pluginIssues];
            } catch (e) {
                console.error(`[Plugin] Failed to run ${plugin.name}`, e);
            }
        }
        return issues;
    }
}

export const pluginRegistry = new PluginRegistry();

// Example Plugin: Check for "Lorem Ipsum"
pluginRegistry.register({
    name: "LoremIpsumDetector",
    check: (html) => {
        if (html.toLowerCase().includes("lorem ipsum")) {
            return [{
                code: 'lorem_ipsum',
                message: 'Placeholder text detected (Lorem Ipsum).',
                severity: 'warning',
                suggestion: 'Replace placeholder text with real content.'
            }];
        }
        return [];
    }
});
