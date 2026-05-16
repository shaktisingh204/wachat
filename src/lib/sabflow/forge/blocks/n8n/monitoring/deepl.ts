/**
 * Forge block: DeepL
 *
 * Source: n8n-master/packages/nodes-base/nodes/DeepL/DeepL.node.ts
 * Credential type: 'deepl' → { apiKey } (free keys end with `:fx`).
 *
 * Operations:
 *   - translation.translate   POST /translate
 *   - usage.get               GET  /usage
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function deeplAuth(ctx: ForgeActionContext): { base: string; key: string } {
  const cred = requireCredential('DeepL', ctx.credential);
  const key = cred.apiKey ?? '';
  if (!key) throw new Error('DeepL: credential is missing `apiKey`');
  const base = key.endsWith(':fx') ? 'https://api-free.deepl.com/v2' : 'https://api.deepl.com/v2';
  return { base, key };
}

async function translationTranslate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { base, key } = deeplAuth(ctx);
  const text = asString(ctx.options.text);
  const targetLang = asString(ctx.options.targetLang);
  if (!text) throw new Error('DeepL: text is required');
  if (!targetLang) throw new Error('DeepL: targetLang is required');

  const form = new URLSearchParams();
  form.append('text', text);
  form.append('target_lang', targetLang);
  const sourceLang = asString(ctx.options.sourceLang);
  const formality = asString(ctx.options.formality);
  const splitSentences = asString(ctx.options.splitSentences);
  const preserveFormatting = asString(ctx.options.preserveFormatting);
  if (sourceLang) form.append('source_lang', sourceLang);
  if (formality) form.append('formality', formality);
  if (splitSentences) form.append('split_sentences', splitSentences);
  if (preserveFormatting) form.append('preserve_formatting', preserveFormatting);

  const res = await apiRequest({
    service: 'DeepL',
    method: 'POST',
    url: `${base}/translate`,
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  });

  const data = res.data as { translations?: Array<{ text: string; detected_source_language?: string }> };
  const first = data.translations?.[0];
  return {
    outputs: {
      translation: first?.text,
      detectedSourceLanguage: first?.detected_source_language,
      translations: data.translations,
    },
    logs: [`DeepL translate → ${targetLang}`],
  };
}

async function usageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { base, key } = deeplAuth(ctx);
  const res = await apiRequest({
    service: 'DeepL',
    method: 'GET',
    url: `${base}/usage`,
    headers: { Authorization: `DeepL-Auth-Key ${key}`, Accept: 'application/json' },
  });
  return { outputs: { usage: res.data }, logs: ['DeepL usage'] };
}

const block: ForgeBlock = {
  id: 'forge_deepl',
  name: 'DeepL',
  description: 'Translate text and check quota with the DeepL API.',
  iconName: 'LuLanguages',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'deepl' },
  actions: [
    {
      id: 'translation_translate',
      label: 'Translate text',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        {
          id: 'targetLang',
          label: 'Target language',
          type: 'select',
          required: true,
          options: [
            { label: 'English (US)', value: 'EN-US' },
            { label: 'English (GB)', value: 'EN-GB' },
            { label: 'German', value: 'DE' },
            { label: 'French', value: 'FR' },
            { label: 'Spanish', value: 'ES' },
            { label: 'Italian', value: 'IT' },
            { label: 'Japanese', value: 'JA' },
            { label: 'Portuguese (PT)', value: 'PT-PT' },
            { label: 'Portuguese (BR)', value: 'PT-BR' },
            { label: 'Russian', value: 'RU' },
            { label: 'Chinese', value: 'ZH' },
            { label: 'Dutch', value: 'NL' },
            { label: 'Polish', value: 'PL' },
          ],
        },
        { id: 'sourceLang', label: 'Source language (optional)', type: 'text', placeholder: 'auto-detect when empty' },
        {
          id: 'formality',
          label: 'Formality',
          type: 'select',
          options: [
            { label: 'Default', value: '' },
            { label: 'More formal', value: 'more' },
            { label: 'Less formal', value: 'less' },
            { label: 'Prefer more', value: 'prefer_more' },
            { label: 'Prefer less', value: 'prefer_less' },
          ],
        },
        { id: 'splitSentences', label: 'Split sentences', type: 'text', placeholder: '0, 1, nonewlines' },
        { id: 'preserveFormatting', label: 'Preserve formatting (0/1)', type: 'text' },
      ],
      run: translationTranslate,
    },
    {
      id: 'usage_get',
      label: 'Get usage',
      fields: [],
      run: usageGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
