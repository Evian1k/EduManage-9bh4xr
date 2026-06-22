// EduManage — Internationalization (i18n) service
// Supports multiple languages. Falls back to English if a translation is missing.
// Languages: English (en), Swahili (sw), French (fr), Arabic (ar), Spanish (es)
//
// Usage:
//   import { t, setLanguage, getCurrentLanguage, LANGUAGES } from '@/lib/i18n';
//   const title = t('common.welcome');
//   setLanguage('sw');

import { translations, LanguageCode } from './translations';

const STORAGE_KEY = '@edumanage_language';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

let currentLanguage: LanguageCode = DEFAULT_LANGUAGE;

// Load saved language from AsyncStorage (browser-safe)
if (typeof window !== 'undefined' && window.localStorage) {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && saved in translations) {
    currentLanguage = saved as LanguageCode;
  }
}

export const LANGUAGES: Record<LanguageCode, { name: string; nativeName: string; flag: string; rtl: boolean }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧', rtl: false },
  sw: { name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪', rtl: false },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
};

export function getCurrentLanguage(): LanguageCode {
  return currentLanguage;
}

export function isRTL(): boolean {
  return LANGUAGES[currentLanguage]?.rtl ?? false;
}

export function setLanguage(lang: LanguageCode): void {
  if (!(lang in translations)) {
    console.warn(`[i18n] Language "${lang}" not supported, falling back to ${DEFAULT_LANGUAGE}`);
    lang = DEFAULT_LANGUAGE;
  }
  currentLanguage = lang;
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }
  // Notify listeners
  languageListeners.forEach(listener => listener(lang));
}

const languageListeners: Set<(lang: LanguageCode) => void> = new Set();

export function onLanguageChange(listener: (lang: LanguageCode) => void): () => void {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}

/**
 * Translate a key. Supports dot notation: t('common.welcome')
 * Supports interpolation: t('finance.invoice_due', { amount: '5000', date: 'Jan 15' })
 * Falls back to English if key missing in current language, then to the key itself.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let value: any = translations[currentLanguage];
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      // Fallback to English
      value = translations[DEFAULT_LANGUAGE];
      for (const p of parts) {
        if (value && typeof value === 'object' && p in value) {
          value = value[p];
        } else {
          return key; // Key not found in any language
        }
      }
      break;
    }
  }
  if (typeof value !== 'string') return key;
  // Interpolate params: replace {param} with actual value
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`));
  }
  return value;
}

/**
 * Format a number according to the current language's locale.
 */
export function formatNumber(value: number): string {
  const localeMap: Record<LanguageCode, string> = {
    en: 'en-US',
    sw: 'sw-KE',
    fr: 'fr-FR',
    ar: 'ar-SA',
    es: 'es-ES',
  };
  try {
    return new Intl.NumberFormat(localeMap[currentLanguage]).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a currency amount.
 */
export function formatCurrency(value: number, currency = 'KES'): string {
  const localeMap: Record<LanguageCode, string> = {
    en: 'en-US',
    sw: 'sw-KE',
    fr: 'fr-FR',
    ar: 'ar-SA',
    es: 'es-ES',
  };
  try {
    return new Intl.NumberFormat(localeMap[currentLanguage], {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

/**
 * Format a date according to the current language's locale.
 */
export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const localeMap: Record<LanguageCode, string> = {
    en: 'en-US',
    sw: 'sw-KE',
    fr: 'fr-FR',
    ar: 'ar-SA',
    es: 'es-ES',
  };
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(localeMap[currentLanguage], opts ?? {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format a relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const localeMap: Record<LanguageCode, string> = {
    en: 'en-US', sw: 'sw-KE', fr: 'fr-FR', ar: 'ar-SA', es: 'es-ES',
  };
  try {
    const rtf = new Intl.RelativeTimeFormat(localeMap[currentLanguage], { numeric: 'auto' });
    if (seconds < 60) return rtf.format(-seconds, 'second');
    if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
    if (seconds < 2592000) return rtf.format(-Math.floor(seconds / 86400), 'day');
    if (seconds < 31536000) return rtf.format(-Math.floor(seconds / 2592000), 'month');
    return rtf.format(-Math.floor(seconds / 31536000), 'year');
  } catch {
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}

export type { LanguageCode };
