// EduManage — React hook for i18n
// Re-renders component when language changes.

import { useState, useEffect, useSyncExternalStore } from 'react';
import {
  getCurrentLanguage,
  onLanguageChange,
  setLanguage,
  isRTL,
  t as translate,
  formatNumber,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  LANGUAGES,
  LanguageCode,
} from '@/lib/i18n';

export function useTranslation() {
  // useSyncExternalStore ensures component re-renders when language changes
  const lang = useSyncExternalStore(
    (callback) => onLanguageChange(callback),
    () => getCurrentLanguage(),
    () => getCurrentLanguage()
  );

  return {
    t: translate,
    lang,
    isRTL: isRTL(),
    setLanguage,
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    languages: LANGUAGES,
  };
}

export { LanguageCode, LANGUAGES };
