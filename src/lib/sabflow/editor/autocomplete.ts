import {
  CompletionContext,
  CompletionResult,
  autocompletion,
  Completion,
} from '@codemirror/autocomplete';

export type VariableOption = {
  label: string;
  type: string;
  info?: string;
};

/**
 * Creates a CodeMirror autocomplete extension that provides suggestions
 * inside `{{ ... }}` blocks for SabFlow variables.
 */
export function expressionAutocomplete(variables: VariableOption[]) {
  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/\{\{\s*[\w$.]*/);
        if (!word) return null;

        // If the user hasn't typed anything inside {{ yet, show all.
        // Otherwise, filter. But the autocomplete engine does basic filtering automatically
        // if we just return the full list from the starting position of the token inside `{{`.

        const tokenMatch = context.matchBefore(/[\w$.]+/);
        const from = tokenMatch ? tokenMatch.from : context.pos;

        const options: Completion[] = variables.map((v) => ({
          label: v.label,
          type: v.type, // 'variable', 'keyword', 'property'
          info: v.info,
        }));

        return {
          from,
          options,
          validFor: /^[\w$.]*$/,
        };
      },
    ],
  });
}
