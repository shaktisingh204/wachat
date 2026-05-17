'use client';

/**
 * SabFlow i18n — minimal stand-in
 *
 * Flat-key dictionary with English fallback. `t()` is safe to call from
 * either client components or plain utility code. `useTranslation()`
 * subscribes React components to active-locale changes so a future locale
 * switcher can flip strings without a reload.
 *
 * Translations here are approximate seed strings — replace with vetted
 * copy before shipping to non-en users.
 */

import { useSyncExternalStore } from 'react';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'hi';

export const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    'executions.title':   'Executions',
    'executions.empty':   'No executions yet',
    'executions.refresh': 'Refresh',
    'api_keys.title':     'API keys',
    'api_keys.create':    'Create key',
    'api_keys.empty':     'No API keys yet',
    'env_vars.title':     'Environment variables',
    'env_vars.create':    'Add variable',
    'env_vars.empty':     'No variables yet',
    'folders.title':      'Folders',
    'folders.create':     'New folder',
    'folders.empty':      'No folders yet',
    'audit.title':        'Audit log',
    'audit.empty':        'No audit entries yet',
    'health.title':       'Health',
    'health.refresh':     'Refresh',
    'import.title':       'Import',
    'import.dropzone':    'Drop a file here, or click to browse',
    'usage.title':        'Usage',
    'usage.empty':        'No usage data yet',
  },
  es: {
    'executions.title':   'Ejecuciones',
    'executions.empty':   'Aún no hay ejecuciones',
    'executions.refresh': 'Actualizar',
    'api_keys.title':     'Claves de API',
    'api_keys.create':    'Crear clave',
    'api_keys.empty':     'Aún no hay claves de API',
    'env_vars.title':     'Variables de entorno',
    'env_vars.create':    'Añadir variable',
    'env_vars.empty':     'Aún no hay variables',
    'folders.title':      'Carpetas',
    'folders.create':     'Nueva carpeta',
    'folders.empty':      'Aún no hay carpetas',
    'audit.title':        'Registro de auditoría',
    'audit.empty':        'Aún no hay entradas de auditoría',
    'health.title':       'Estado',
    'health.refresh':     'Actualizar',
    'import.title':       'Importar',
    'import.dropzone':    'Suelte un archivo aquí o haga clic para buscar',
    'usage.title':        'Uso',
    'usage.empty':        'Aún no hay datos de uso',
  },
  fr: {
    'executions.title':   'Exécutions',
    'executions.empty':   'Aucune exécution pour le moment',
    'executions.refresh': 'Actualiser',
    'api_keys.title':     'Clés API',
    'api_keys.create':    'Créer une clé',
    'api_keys.empty':     'Aucune clé API pour le moment',
    'env_vars.title':     "Variables d'environnement",
    'env_vars.create':    'Ajouter une variable',
    'env_vars.empty':     'Aucune variable pour le moment',
    'folders.title':      'Dossiers',
    'folders.create':     'Nouveau dossier',
    'folders.empty':      'Aucun dossier pour le moment',
    'audit.title':        "Journal d'audit",
    'audit.empty':        "Aucune entrée d'audit pour le moment",
    'health.title':       'Santé',
    'health.refresh':     'Actualiser',
    'import.title':       'Importer',
    'import.dropzone':    'Déposez un fichier ici ou cliquez pour parcourir',
    'usage.title':        'Utilisation',
    'usage.empty':        "Aucune donnée d'utilisation",
  },
  de: {
    'executions.title':   'Ausführungen',
    'executions.empty':   'Noch keine Ausführungen',
    'executions.refresh': 'Aktualisieren',
    'api_keys.title':     'API-Schlüssel',
    'api_keys.create':    'Schlüssel erstellen',
    'api_keys.empty':     'Noch keine API-Schlüssel',
    'env_vars.title':     'Umgebungsvariablen',
    'env_vars.create':    'Variable hinzufügen',
    'env_vars.empty':     'Noch keine Variablen',
    'folders.title':      'Ordner',
    'folders.create':     'Neuer Ordner',
    'folders.empty':      'Noch keine Ordner',
    'audit.title':        'Audit-Protokoll',
    'audit.empty':        'Noch keine Audit-Einträge',
    'health.title':       'Status',
    'health.refresh':     'Aktualisieren',
    'import.title':       'Importieren',
    'import.dropzone':    'Datei hier ablegen oder klicken zum Auswählen',
    'usage.title':        'Nutzung',
    'usage.empty':        'Noch keine Nutzungsdaten',
  },
  pt: {
    'executions.title':   'Execuções',
    'executions.empty':   'Ainda não há execuções',
    'executions.refresh': 'Atualizar',
    'api_keys.title':     'Chaves de API',
    'api_keys.create':    'Criar chave',
    'api_keys.empty':     'Ainda não há chaves de API',
    'env_vars.title':     'Variáveis de ambiente',
    'env_vars.create':    'Adicionar variável',
    'env_vars.empty':     'Ainda não há variáveis',
    'folders.title':      'Pastas',
    'folders.create':     'Nova pasta',
    'folders.empty':      'Ainda não há pastas',
    'audit.title':        'Registro de auditoria',
    'audit.empty':        'Ainda não há entradas de auditoria',
    'health.title':       'Saúde',
    'health.refresh':     'Atualizar',
    'import.title':       'Importar',
    'import.dropzone':    'Solte um arquivo aqui ou clique para procurar',
    'usage.title':        'Uso',
    'usage.empty':        'Ainda não há dados de uso',
  },
  ja: {
    'executions.title':   '実行',
    'executions.empty':   'まだ実行はありません',
    'executions.refresh': '更新',
    'api_keys.title':     'API キー',
    'api_keys.create':    'キーを作成',
    'api_keys.empty':     'API キーがまだありません',
    'env_vars.title':     '環境変数',
    'env_vars.create':    '変数を追加',
    'env_vars.empty':     '変数がまだありません',
    'folders.title':      'フォルダー',
    'folders.create':     '新しいフォルダー',
    'folders.empty':      'フォルダーがまだありません',
    'audit.title':        '監査ログ',
    'audit.empty':        '監査エントリがまだありません',
    'health.title':       'ヘルス',
    'health.refresh':     '更新',
    'import.title':       'インポート',
    'import.dropzone':    'ファイルをここにドロップするかクリックして参照',
    'usage.title':        '使用状況',
    'usage.empty':        '使用状況データがまだありません',
  },
  hi: {
    'executions.title':   'निष्पादन',
    'executions.empty':   'अभी तक कोई निष्पादन नहीं',
    'executions.refresh': 'ताज़ा करें',
    'api_keys.title':     'एपीआई कुंजियाँ',
    'api_keys.create':    'कुंजी बनाएँ',
    'api_keys.empty':     'अभी तक कोई एपीआई कुंजी नहीं',
    'env_vars.title':     'पर्यावरण चर',
    'env_vars.create':    'चर जोड़ें',
    'env_vars.empty':     'अभी तक कोई चर नहीं',
    'folders.title':      'फ़ोल्डर',
    'folders.create':     'नया फ़ोल्डर',
    'folders.empty':      'अभी तक कोई फ़ोल्डर नहीं',
    'audit.title':        'ऑडिट लॉग',
    'audit.empty':        'अभी तक कोई ऑडिट प्रविष्टि नहीं',
    'health.title':       'स्वास्थ्य',
    'health.refresh':     'ताज़ा करें',
    'import.title':       'आयात',
    'import.dropzone':    'यहाँ फ़ाइल छोड़ें, या ब्राउज़ करने के लिए क्लिक करें',
    'usage.title':        'उपयोग',
    'usage.empty':        'अभी तक कोई उपयोग डेटा नहीं',
  },
};

let activeLocale: Locale = 'en';
const listeners = new Set<() => void>();

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function setActiveLocale(locale: Locale): void {
  if (locale === activeLocale) return;
  activeLocale = locale;
  listeners.forEach((l) => l());
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : `{${k}}`,
  );
}

export function t(
  key: string,
  locale?: Locale,
  params?: Record<string, string | number>,
): string {
  const loc = locale ?? activeLocale;
  const raw = TRANSLATIONS[loc]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return interpolate(raw, params);
}

export function useTranslation(): {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
} {
  const locale = useSyncExternalStore<Locale>(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => activeLocale,
    () => 'en' as Locale,
  );
  return {
    t: (key, params) => t(key, locale, params),
    locale,
    setLocale: setActiveLocale,
  };
}
