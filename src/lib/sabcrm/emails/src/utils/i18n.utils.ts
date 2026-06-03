// Ported from twenty-emails — Next.js/Mongo idioms, no NestJS DI
import { type Messages } from '@lingui/core';
import { createI18nInstanceFactory } from '@/lib/sabcrm/shared/src';
import { type APP_LOCALES } from '@/lib/sabcrm/shared/src';
import { messages as afMessages } from '@/lib/sabcrm/emails/src/locales/generated/af-ZA';
import { messages as arMessages } from '@/lib/sabcrm/emails/src/locales/generated/ar-SA';
import { messages as caMessages } from '@/lib/sabcrm/emails/src/locales/generated/ca-ES';
import { messages as csMessages } from '@/lib/sabcrm/emails/src/locales/generated/cs-CZ';
import { messages as daMessages } from '@/lib/sabcrm/emails/src/locales/generated/da-DK';
import { messages as deMessages } from '@/lib/sabcrm/emails/src/locales/generated/de-DE';
import { messages as elMessages } from '@/lib/sabcrm/emails/src/locales/generated/el-GR';
import { messages as enMessages } from '@/lib/sabcrm/emails/src/locales/generated/en';
import { messages as esMessages } from '@/lib/sabcrm/emails/src/locales/generated/es-ES';
import { messages as fiMessages } from '@/lib/sabcrm/emails/src/locales/generated/fi-FI';
import { messages as frMessages } from '@/lib/sabcrm/emails/src/locales/generated/fr-FR';
import { messages as heMessages } from '@/lib/sabcrm/emails/src/locales/generated/he-IL';
import { messages as huMessages } from '@/lib/sabcrm/emails/src/locales/generated/hu-HU';
import { messages as itMessages } from '@/lib/sabcrm/emails/src/locales/generated/it-IT';
import { messages as jaMessages } from '@/lib/sabcrm/emails/src/locales/generated/ja-JP';
import { messages as koMessages } from '@/lib/sabcrm/emails/src/locales/generated/ko-KR';
import { messages as nlMessages } from '@/lib/sabcrm/emails/src/locales/generated/nl-NL';
import { messages as noMessages } from '@/lib/sabcrm/emails/src/locales/generated/no-NO';
import { messages as plMessages } from '@/lib/sabcrm/emails/src/locales/generated/pl-PL';
import { messages as pseudoEnMessages } from '@/lib/sabcrm/emails/src/locales/generated/pseudo-en';
import { messages as ptBRMessages } from '@/lib/sabcrm/emails/src/locales/generated/pt-BR';
import { messages as ptPTMessages } from '@/lib/sabcrm/emails/src/locales/generated/pt-PT';
import { messages as roMessages } from '@/lib/sabcrm/emails/src/locales/generated/ro-RO';
import { messages as ruMessages } from '@/lib/sabcrm/emails/src/locales/generated/ru-RU';
import { messages as srMessages } from '@/lib/sabcrm/emails/src/locales/generated/sr-Cyrl';
import { messages as svMessages } from '@/lib/sabcrm/emails/src/locales/generated/sv-SE';
import { messages as trMessages } from '@/lib/sabcrm/emails/src/locales/generated/tr-TR';
import { messages as ukMessages } from '@/lib/sabcrm/emails/src/locales/generated/uk-UA';
import { messages as viMessages } from '@/lib/sabcrm/emails/src/locales/generated/vi-VN';
import { messages as zhHansMessages } from '@/lib/sabcrm/emails/src/locales/generated/zh-CN';
import { messages as zhHantMessages } from '@/lib/sabcrm/emails/src/locales/generated/zh-TW';

const messages: Record<keyof typeof APP_LOCALES, Messages> = {
  en: enMessages,
  'pseudo-en': pseudoEnMessages,
  'af-ZA': afMessages,
  'ar-SA': arMessages,
  'ca-ES': caMessages,
  'cs-CZ': csMessages,
  'da-DK': daMessages,
  'de-DE': deMessages,
  'el-GR': elMessages,
  'es-ES': esMessages,
  'fi-FI': fiMessages,
  'fr-FR': frMessages,
  'he-IL': heMessages,
  'hu-HU': huMessages,
  'it-IT': itMessages,
  'ja-JP': jaMessages,
  'ko-KR': koMessages,
  'nl-NL': nlMessages,
  'no-NO': noMessages,
  'pl-PL': plMessages,
  'pt-BR': ptBRMessages,
  'pt-PT': ptPTMessages,
  'ro-RO': roMessages,
  'ru-RU': ruMessages,
  'sr-Cyrl': srMessages,
  'sv-SE': svMessages,
  'tr-TR': trMessages,
  'uk-UA': ukMessages,
  'vi-VN': viMessages,
  'zh-CN': zhHansMessages,
  'zh-TW': zhHantMessages,
};

export const createI18nInstance = createI18nInstanceFactory(messages);
