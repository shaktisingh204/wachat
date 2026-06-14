/**
 * SabSign signer-portal i18n. Lightweight string tables — no runtime dep.
 * `t(locale, key)` falls back to English for missing locales/keys. Add a
 * language by adding its column; the portal language picker derives from
 * `LOCALES`.
 */

export type SignLocaleKey =
  | 'reviewSign'
  | 'finishSign'
  | 'decline'
  | 'submitting'
  | 'yourFields'
  | 'nothingToFill'
  | 'consent'
  | 'agreeFirst'
  | 'smsCode'
  | 'sendCode'
  | 'pin'
  | 'identityQuestions'
  | 'loading'
  | 'allSet'
  | 'declinedThanks'
  | 'language';

type Table = Record<SignLocaleKey, string>;

const en: Table = {
  reviewSign: 'Review & sign',
  finishSign: 'Finish & sign',
  decline: 'Decline',
  submitting: 'Submitting…',
  yourFields: 'Your fields',
  nothingToFill: 'Nothing to fill. Only your signature is required.',
  consent:
    'I agree to sign this document electronically, and that my electronic signature is the legal equivalent of my handwritten signature.',
  agreeFirst: 'Please agree to sign this document electronically before submitting.',
  smsCode: 'SMS code',
  sendCode: 'Send code',
  pin: 'PIN',
  identityQuestions: 'Identity questions',
  loading: 'Loading document…',
  allSet: 'All set',
  declinedThanks: 'Declined. Thank you.',
  language: 'Language',
};

const es: Table = {
  reviewSign: 'Revisar y firmar',
  finishSign: 'Finalizar y firmar',
  decline: 'Rechazar',
  submitting: 'Enviando…',
  yourFields: 'Tus campos',
  nothingToFill: 'Nada que rellenar. Solo se requiere tu firma.',
  consent:
    'Acepto firmar este documento electrónicamente y que mi firma electrónica es el equivalente legal de mi firma manuscrita.',
  agreeFirst: 'Acepta firmar este documento electrónicamente antes de enviar.',
  smsCode: 'Código SMS',
  sendCode: 'Enviar código',
  pin: 'PIN',
  identityQuestions: 'Preguntas de identidad',
  loading: 'Cargando documento…',
  allSet: 'Listo',
  declinedThanks: 'Rechazado. Gracias.',
  language: 'Idioma',
};

const fr: Table = {
  reviewSign: 'Vérifier et signer',
  finishSign: 'Terminer et signer',
  decline: 'Refuser',
  submitting: 'Envoi…',
  yourFields: 'Vos champs',
  nothingToFill: 'Rien à remplir. Seule votre signature est requise.',
  consent:
    'J’accepte de signer ce document électroniquement et que ma signature électronique soit l’équivalent légal de ma signature manuscrite.',
  agreeFirst: 'Veuillez accepter de signer ce document électroniquement avant d’envoyer.',
  smsCode: 'Code SMS',
  sendCode: 'Envoyer le code',
  pin: 'PIN',
  identityQuestions: 'Questions d’identité',
  loading: 'Chargement du document…',
  allSet: 'Terminé',
  declinedThanks: 'Refusé. Merci.',
  language: 'Langue',
};

const de: Table = {
  reviewSign: 'Prüfen & unterschreiben',
  finishSign: 'Abschließen & unterschreiben',
  decline: 'Ablehnen',
  submitting: 'Wird gesendet…',
  yourFields: 'Ihre Felder',
  nothingToFill: 'Nichts auszufüllen. Nur Ihre Unterschrift ist erforderlich.',
  consent:
    'Ich stimme zu, dieses Dokument elektronisch zu unterschreiben, und dass meine elektronische Unterschrift dem rechtlichen Äquivalent meiner handschriftlichen Unterschrift entspricht.',
  agreeFirst: 'Bitte stimmen Sie zu, dieses Dokument elektronisch zu unterschreiben.',
  smsCode: 'SMS-Code',
  sendCode: 'Code senden',
  pin: 'PIN',
  identityQuestions: 'Identitätsfragen',
  loading: 'Dokument wird geladen…',
  allSet: 'Fertig',
  declinedThanks: 'Abgelehnt. Danke.',
  language: 'Sprache',
};

const pt: Table = {
  reviewSign: 'Revisar e assinar',
  finishSign: 'Concluir e assinar',
  decline: 'Recusar',
  submitting: 'Enviando…',
  yourFields: 'Seus campos',
  nothingToFill: 'Nada a preencher. Apenas a sua assinatura é necessária.',
  consent:
    'Concordo em assinar este documento eletronicamente e que a minha assinatura eletrónica é o equivalente legal da minha assinatura manuscrita.',
  agreeFirst: 'Concorde em assinar este documento eletronicamente antes de enviar.',
  smsCode: 'Código SMS',
  sendCode: 'Enviar código',
  pin: 'PIN',
  identityQuestions: 'Perguntas de identidade',
  loading: 'A carregar o documento…',
  allSet: 'Pronto',
  declinedThanks: 'Recusado. Obrigado.',
  language: 'Idioma',
};

const it: Table = {
  reviewSign: 'Rivedi e firma',
  finishSign: 'Completa e firma',
  decline: 'Rifiuta',
  submitting: 'Invio…',
  yourFields: 'I tuoi campi',
  nothingToFill: 'Niente da compilare. È richiesta solo la tua firma.',
  consent:
    'Accetto di firmare questo documento elettronicamente e che la mia firma elettronica sia l’equivalente legale della mia firma autografa.',
  agreeFirst: 'Accetta di firmare questo documento elettronicamente prima di inviare.',
  smsCode: 'Codice SMS',
  sendCode: 'Invia codice',
  pin: 'PIN',
  identityQuestions: 'Domande di identità',
  loading: 'Caricamento del documento…',
  allSet: 'Fatto',
  declinedThanks: 'Rifiutato. Grazie.',
  language: 'Lingua',
};

const nl: Table = {
  reviewSign: 'Bekijken en ondertekenen',
  finishSign: 'Voltooien en ondertekenen',
  decline: 'Weigeren',
  submitting: 'Verzenden…',
  yourFields: 'Uw velden',
  nothingToFill: 'Niets in te vullen. Alleen uw handtekening is vereist.',
  consent:
    'Ik ga ermee akkoord dit document elektronisch te ondertekenen en dat mijn elektronische handtekening het juridische equivalent is van mijn handgeschreven handtekening.',
  agreeFirst: 'Ga akkoord om dit document elektronisch te ondertekenen voordat u verzendt.',
  smsCode: 'Sms-code',
  sendCode: 'Code verzenden',
  pin: 'Pincode',
  identityQuestions: 'Identiteitsvragen',
  loading: 'Document laden…',
  allSet: 'Klaar',
  declinedThanks: 'Geweigerd. Bedankt.',
  language: 'Taal',
};

const hi: Table = {
  reviewSign: 'समीक्षा करें और हस्ताक्षर करें',
  finishSign: 'पूर्ण करें और हस्ताक्षर करें',
  decline: 'अस्वीकार करें',
  submitting: 'भेजा जा रहा है…',
  yourFields: 'आपके फ़ील्ड',
  nothingToFill: 'भरने के लिए कुछ नहीं। केवल आपके हस्ताक्षर आवश्यक हैं।',
  consent:
    'मैं इस दस्तावेज़ पर इलेक्ट्रॉनिक रूप से हस्ताक्षर करने और यह मानने के लिए सहमत हूँ कि मेरा इलेक्ट्रॉनिक हस्ताक्षर मेरे हस्तलिखित हस्ताक्षर के कानूनी समकक्ष है।',
  agreeFirst: 'कृपया भेजने से पहले इस दस्तावेज़ पर इलेक्ट्रॉनिक रूप से हस्ताक्षर करने के लिए सहमत हों।',
  smsCode: 'एसएमएस कोड',
  sendCode: 'कोड भेजें',
  pin: 'पिन',
  identityQuestions: 'पहचान प्रश्न',
  loading: 'दस्तावेज़ लोड हो रहा है…',
  allSet: 'पूर्ण',
  declinedThanks: 'अस्वीकृत। धन्यवाद।',
  language: 'भाषा',
};

const TABLES: Record<string, Table> = { en, es, fr, de, pt, it, nl, hi };

export const LOCALES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'hi', label: 'हिन्दी' },
];

export function normalizeLocale(input?: string | null): string {
  if (!input) return 'en';
  const base = input.toLowerCase().split('-')[0];
  return TABLES[base] ? base : 'en';
}

export function t(locale: string, key: SignLocaleKey): string {
  const table = TABLES[normalizeLocale(locale)] ?? en;
  return table[key] ?? en[key];
}
