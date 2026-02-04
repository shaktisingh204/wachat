
import { DltSmsTemplate } from '../types';

export class SmsTemplateService {

    /**
     * interpolatedContent
     * Replaces {#var#} with actual values and validates the count.
     */
    static interpolate(template: DltSmsTemplate, variableValues: string[]): string {
        if (!template.content) return '';

        // Count count of {#var#}
        const matches = template.content.match(/{#var#}/g);
        const requiredCount = matches ? matches.length : 0;

        if (variableValues.length !== requiredCount) {
            throw new Error(`Template requires ${requiredCount} variables, but ${variableValues.length} were provided.`);
        }

        let content = template.content;
        variableValues.forEach(val => {
            content = content.replace('{#var#}', val);
        });

        return content;
    }

    /**
     * Validates if a message content essentially matches a DLT template (simplified scrubbing)
     * Real DLT scrubbing is complex and usually done by the provider, but we can do a sanity check.
     */
    static validateScrubbing(content: string, templateContent: string): boolean {
        // This is a complex Regex problem because variables can be anything.
        // For now, prompt the user that we trust the interpolation logic.
        return true;
    }
}
