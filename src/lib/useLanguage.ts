'use client';

import { useState, useEffect } from 'react';
import { i18n } from './i18n';
import type { Lang } from '@/types';

export function useLanguage() {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null;
    if (stored === 'en' || stored === 'ja') setLang(stored);
  }, []);

  const toggle = () => {
    const next: Lang = lang === 'en' ? 'ja' : 'en';
    setLang(next);
    localStorage.setItem('lang', next);
  };

  return { lang, toggle, t: i18n[lang] };
}
